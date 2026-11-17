import axios from "axios";
import { Router } from "express";
import { requireEnv } from "../lib/requireEnv.js";

const router = Router();

const COUNTY_LAUS_CACHE_TTL = 24 * 60 * 60 * 1000;
const COUNTY_SERIES_BATCH_SIZE = 50;
const COUNTY_SERIES_BATCH_CONCURRENCY = 1;
const COUNTY_SERIES_REQUEST_DELAY = 1000;
const COUNTY_LAUS_FIRST_YEAR = 1990;
const COUNTY_LAUS_MAX_YEAR_SPAN = 20;
const COUNTY_LAUS_CACHE_MAX_ENTRIES = 20;
const countyUnemploymentCache = new Map();
const countyUnemploymentRequests = new Map();
const SAIPE_CACHE_TTL = 24 * 60 * 60 * 1000;
const SAIPE_CACHE_MAX_ENTRIES = 40;
const SAIPE_FIRST_YEAR = 1989;
const SAIPE_YEAR_PROBE_BATCH_SIZE = 5;
const saipeCountyCache = new Map();
let saipeAvailabilityCache = null;

function periodName(year, month) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
}

async function fetchCountyPoverty(apiKey, year) {
  const cached = saipeCountyCache.get(year);
  if (cached && Date.now() - cached.fetchedAt < SAIPE_CACHE_TTL) {
    return cached.counties;
  }

  const response = await axios.get("https://api.census.gov/data/timeseries/poverty/saipe", {
    params: {
      get: "NAME,SAEPOVRTALL_PT",
      for: "county:*",
      in: "state:*",
      time: String(year),
      key: apiKey,
    },
    timeout: 30000,
  });
  const rows = response.data;
  if (!Array.isArray(rows) || !Array.isArray(rows[0])) {
    throw new Error("Unexpected response from Census SAIPE API");
  }

  const columns = Object.fromEntries(rows[0].map((name, index) => [name, index]));
  const requiredColumns = ["NAME", "SAEPOVRTALL_PT", "state", "county"];
  if (requiredColumns.some((name) => columns[name] == null)) {
    throw new Error("Census SAIPE response is missing required poverty columns");
  }

  const counties = rows.slice(1).flatMap((row) => {
    const stateFips = row[columns.state];
    const countyFips = row[columns.county];
    const povertyRate = Number(row[columns.SAEPOVRTALL_PT]);
    if (
      !/^\d{2}$/.test(stateFips)
      || !/^\d{3}$/.test(countyFips)
      || !Number.isFinite(povertyRate)
      || povertyRate < 0
    ) {
      return [];
    }

    return [{
      geoid: `${stateFips}${countyFips}`,
      name: row[columns.NAME],
      povertyRate,
    }];
  });

  saipeCountyCache.set(year, { counties, fetchedAt: Date.now() });
  if (saipeCountyCache.size > SAIPE_CACHE_MAX_ENTRIES) {
    saipeCountyCache.delete(saipeCountyCache.keys().next().value);
  }
  return counties;
}

async function findSaipeAvailability(apiKey) {
  if (
    saipeAvailabilityCache
    && Date.now() - saipeAvailabilityCache.fetchedAt < SAIPE_CACHE_TTL
  ) {
    return saipeAvailabilityCache;
  }

  const metadataResponse = await axios.get(
    "https://api.census.gov/data/timeseries/poverty/saipe.json",
    { timeout: 30000 },
  );
  const dataset = metadataResponse.data?.dataset?.[0];
  const temporalRange = dataset?.temporal;
  const latestYearMatch = typeof temporalRange === "string"
    ? temporalRange.match(/\/(\d{4})$/)
    : null;
  const latestYear = Number(latestYearMatch?.[1]);
  if (!Number.isInteger(latestYear) || latestYear < SAIPE_FIRST_YEAR) {
    throw new Error("Census SAIPE metadata did not include a valid latest year");
  }

  const availableYears = [];
  for (
    let batchStart = SAIPE_FIRST_YEAR;
    batchStart <= latestYear;
    batchStart += SAIPE_YEAR_PROBE_BATCH_SIZE
  ) {
    const years = Array.from(
      { length: Math.min(SAIPE_YEAR_PROBE_BATCH_SIZE, latestYear - batchStart + 1) },
      (_, index) => batchStart + index,
    );
    const yearResults = await Promise.all(years.map(async (year) => {
      const response = await axios.get(
        "https://api.census.gov/data/timeseries/poverty/saipe",
        {
          params: {
            get: "NAME",
            for: "county:001",
            in: "state:01",
            time: String(year),
            key: apiKey,
          },
          timeout: 30000,
        },
      );
      return Array.isArray(response.data) && response.data.length > 1 ? year : null;
    }));
    availableYears.push(...yearResults.filter((year) => year != null));
  }

  if (!availableYears.includes(latestYear)) {
    throw new Error(`Census SAIPE metadata year ${latestYear} has no county estimates`);
  }
  saipeAvailabilityCache = {
    latestYear,
    availableYears,
    fetchedAt: Date.now(),
  };
  return saipeAvailabilityCache;
}

export function parseCountyUnemploymentMonths(series, countyBySeriesId) {
  const countiesByDate = new Map();
  for (const seriesResult of series) {
    const county = countyBySeriesId.get(seriesResult.seriesID);
    if (!county || !Array.isArray(seriesResult.data)) continue;

    for (const observation of seriesResult.data) {
      const year = Number(observation.year);
      const periodMatch = observation.period?.match(/^M(0[1-9]|1[0-2])$/);
      const unemploymentRate = Number(observation.value);
      if (!Number.isInteger(year) || !periodMatch || !Number.isFinite(unemploymentRate)) {
        continue;
      }

      const month = Number(periodMatch[1]);
      const dateKey = year * 100 + month;
      if (!countiesByDate.has(dateKey)) countiesByDate.set(dateKey, new Map());
      countiesByDate.get(dateKey).set(county.geoid, {
        geoid: county.geoid,
        name: county.name,
        unemploymentRate,
      });
    }
  }

  return Array.from(countiesByDate.entries())
    .sort(([dateA], [dateB]) => dateA - dateB)
    .map(([dateKey, countiesByGeoid]) => {
      const year = Math.floor(dateKey / 100);
      const month = dateKey % 100;
      const counties = Array.from(countiesByGeoid.values());
      return {
        year,
        period: `M${String(month).padStart(2, "0")}`,
        periodName: periodName(year, month),
        count: counties.length,
        counties,
      };
    });
}

function latestCountyUnemploymentMonth(months) {
  const latestByCounty = new Map();
  for (const month of months) {
    const dateKey = month.year * 100 + Number(month.period.slice(1));
    for (const county of month.counties) {
      latestByCounty.set(county.geoid, { dateKey, county });
    }
  }

  const coverageByDate = new Map();
  for (const { dateKey } of latestByCounty.values()) {
    coverageByDate.set(dateKey, (coverageByDate.get(dateKey) ?? 0) + 1);
  }
  const latestDateKey = Array.from(coverageByDate.entries()).reduce(
    (bestDateKey, [dateKey, count]) => {
      const bestCount = coverageByDate.get(bestDateKey);
      return count > bestCount || (count === bestCount && dateKey > bestDateKey)
        ? dateKey
        : bestDateKey;
    },
    Math.max(...coverageByDate.keys()),
  );
  const selectedMonth = months.find((month) =>
    month.year * 100 + Number(month.period.slice(1)) === latestDateKey
  );

  return {
    ...selectedMonth,
    count: coverageByDate.get(latestDateKey),
    counties: Array.from(latestByCounty.values())
      .filter(({ dateKey }) => dateKey === latestDateKey)
      .map(({ county }) => county),
  };
}

export function parseCountyUnemploymentSeries(series, countyBySeriesId) {
  const months = parseCountyUnemploymentMonths(series, countyBySeriesId);
  if (!months.length) return null;

  return {
    source: "U.S. Bureau of Labor Statistics — Local Area Unemployment Statistics",
    ...latestCountyUnemploymentMonth(months),
  };
}

export function parseCountyUnemploymentDateRange(start, end, currentYear = new Date().getUTCFullYear()) {
  if (start == null && end == null) return null;
  if (typeof start !== "string" || typeof end !== "string") {
    throw new TypeError("Both start and end are required in YYYY-MM format");
  }

  const startMatch = start.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  const endMatch = end.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!startMatch || !endMatch) {
    throw new TypeError("start and end must use YYYY-MM format");
  }

  const startYear = Number(startMatch[1]);
  const endYear = Number(endMatch[1]);
  if (
    startYear < COUNTY_LAUS_FIRST_YEAR
    || endYear > currentYear
    || endYear - startYear >= COUNTY_LAUS_MAX_YEAR_SPAN
    || start > end
  ) {
    throw new TypeError(
      `Date range must be ordered, between ${COUNTY_LAUS_FIRST_YEAR} and ${currentYear}, and no longer than ${COUNTY_LAUS_MAX_YEAR_SPAN} years`,
    );
  }

  return { start, end, startYear, endYear };
}

async function fetchCountyUnemployment(apiKey, censusApiKey, startYear, endYear) {
  const censusResponse = await axios.get("https://api.census.gov/data/2024/acs/acs5", {
    params: {
      get: "NAME",
      for: "county:*",
      in: "state:*",
      key: censusApiKey,
    },
    timeout: 30000,
  });
  const rows = censusResponse.data;
  if (!Array.isArray(rows) || !Array.isArray(rows[0])) {
    throw new Error("Unexpected response from Census API while listing counties");
  }

  const columns = Object.fromEntries(rows[0].map((name, index) => [name, index]));
  if (["NAME", "state", "county"].some((name) => columns[name] == null)) {
    throw new Error("Census API county response is missing required columns");
  }

  const counties = rows.slice(1).flatMap((row) => {
    const stateFips = row[columns.state];
    const countyFips = row[columns.county];
    const name = row[columns.NAME];
    if (!/^\d{2}$/.test(stateFips) || !/^\d{3}$/.test(countyFips) || !name) return [];

    const geoid = `${stateFips}${countyFips}`;
    return [{
      geoid,
      name,
      seriesId: `LAUCN${geoid}0000000003`,
    }];
  });
  if (!counties.length) {
    throw new Error("Census API returned no county GEOIDs for BLS series lookup");
  }

  const countyBySeriesId = new Map(counties.map((county) => [county.seriesId, county]));
  const seriesIds = counties.map((county) => county.seriesId);
  const batches = [];
  for (let i = 0; i < seriesIds.length; i += COUNTY_SERIES_BATCH_SIZE) {
    batches.push(seriesIds.slice(i, i + COUNTY_SERIES_BATCH_SIZE));
  }

  const seriesResults = [];
  for (let i = 0; i < batches.length; i += COUNTY_SERIES_BATCH_CONCURRENCY) {
    const batchResponses = await Promise.all(
      batches.slice(i, i + COUNTY_SERIES_BATCH_CONCURRENCY).map(async (batch) => {
        const requestBody = {
          seriesid: batch,
          startyear: String(startYear),
          endyear: String(endYear),
          registrationkey: apiKey,
        };
        let response;
        for (let attempt = 0; ; attempt += 1) {
          try {
            response = await axios.post(
              "https://api.bls.gov/publicAPI/v2/timeseries/data/",
              requestBody,
              { timeout: 30000 },
            );
            break;
          } catch (error) {
            if (error.response?.status !== 429 || attempt >= 3) throw error;
            await new Promise((resolve) => setTimeout(resolve, 1000 * (2 ** attempt)));
          }
        }
        if (
          response.data?.status !== "REQUEST_SUCCEEDED"
          || !Array.isArray(response.data?.Results?.series)
        ) {
          const messages = response.data?.message;
          const detail = Array.isArray(messages)
            ? messages.join("; ")
            : typeof messages === "string"
              ? messages
              : null;
          throw new Error(detail || "BLS API returned an unsuccessful response");
        }
        return response.data.Results.series;
      }),
    );
    seriesResults.push(...batchResponses.flat());
    if (i + COUNTY_SERIES_BATCH_CONCURRENCY < batches.length) {
      await new Promise((resolve) => setTimeout(resolve, COUNTY_SERIES_REQUEST_DELAY));
    }
  }

  return parseCountyUnemploymentMonths(seriesResults, countyBySeriesId);
}

router.get("/test", (req, res) => {
  res.json({ response: "Success: Viewing Economic Data" });
});

/**
 * State GDP from U.S. Bureau of Economic Analysis (BEA) Regional API.
 * Requires BEA_API_KEY — https://apps.bea.gov/API/signup/
 */
router.get("/gdpByState", async (req, res) => {
  const apiKey = requireEnv(res, "BEA_API_KEY", "BEA API key");
  if (!apiKey) return;

  const year = (req.query.year || "2022").toString().trim();

  try {
    const response = await axios.get("https://apps.bea.gov/api/data/", {
      params: {
        UserID: apiKey,
        method: "GetData",
        datasetname: "Regional",
        TableName: "SAGDP2N",
        LineCode: "1",
        GeoFIPS: "STATE",
        Year: year,
        ResultFormat: "JSON",
      },
    });

    const results = response.data?.BEAAPI?.Results?.Data;
    if (!Array.isArray(results)) {
      return res.status(502).json({ error: "Unexpected response from BEA API" });
    }

    const states = results.map((row) => ({
      geoFips: row.GeoFips,
      geoName: row.GeoName,
      year: row.TimePeriod,
      gdpMillions: Number(row.DataValue?.replace(/,/g, "")),
      unit: row.CL_UNIT,
    }));

    res.json({
      source: "U.S. Bureau of Economic Analysis — Regional Economic Accounts",
      year,
      count: states.length,
      states,
    });
  } catch (error) {
    console.error("Economics gdpByState error:", error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.Error?.ErrorDetail?.Description
        || error.message
        || "Failed to fetch BEA data",
    });
  }
});

router.get("/povertyByCounty", async (req, res) => {
  const apiKey = process.env.ECONOMY_KEY?.trim() || process.env.CENSUS_API_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({
      error: "Economy API key is not configured. Set ECONOMY_KEY or CENSUS_API_KEY in backend/.env.",
    });
  }

  const lower = apiKey.toLowerCase();
  if (["your-", "replace-me", "changeme"].some((prefix) => lower.startsWith(prefix))) {
    return res.status(503).json({
      error: "Economy API key is still a placeholder. Replace ECONOMY_KEY or CENSUS_API_KEY in backend/.env with your real Census API key.",
    });
  }

  const requestedYear = req.query.year;
  let year = null;
  if (requestedYear != null) {
    const parsedYear = Number(requestedYear);
    if (
      typeof requestedYear !== "string"
      || !/^\d{4}$/.test(requestedYear)
      || !Number.isInteger(parsedYear)
      || parsedYear < SAIPE_FIRST_YEAR
      || parsedYear > new Date().getUTCFullYear()
    ) {
      return res.status(400).json({ error: "year must be an available SAIPE year" });
    }
    year = parsedYear;
  }
  try {
    const { latestYear, availableYears } = await findSaipeAvailability(apiKey);
    if (year == null) year = latestYear;
    if (!availableYears.includes(year)) {
      return res.status(400).json({ error: `No SAIPE estimates are available for ${year}` });
    }

    const counties = await fetchCountyPoverty(apiKey, year);
    if (!counties.length) {
      return res.status(404).json({ error: `Census SAIPE has no county poverty estimates for ${year}` });
    }

    return res.json({
      source: "U.S. Census Bureau — Small Area Income and Poverty Estimates (SAIPE)",
      year,
      latestYear,
      availableYears,
      count: counties.length,
      counties,
    });
  } catch (error) {
    console.error("Economics povertyByCounty error:", error.message);
    return res.status(error.response?.status || 502).json({
      error: error.response?.data?.error || error.message || "Failed to fetch Census poverty data",
    });
  }
});

router.get("/incomeByCounty", async (_req, res) => {
  const apiKey = requireEnv(res, "ECONOMY_KEY", "Economy API key");
  if (!apiKey) return;

  try {
    const response = await axios.get("https://api.census.gov/data/2024/acs/acs5", {
      params: {
        get: "NAME,B19013_001E",
        for: "county:*",
        in: "state:*",
        key: apiKey,
      },
    });

    const rows = response.data;
    if (!Array.isArray(rows) || !Array.isArray(rows[0])) {
      return res.status(502).json({ error: "Unexpected response from Census API" });
    }

    const columns = Object.fromEntries(rows[0].map((name, index) => [name, index]));
    const requiredColumns = ["NAME", "B19013_001E", "state", "county"];
    if (requiredColumns.some((name) => columns[name] == null)) {
      return res.status(502).json({ error: "Census API response is missing required columns" });
    }

    const counties = rows.slice(1).flatMap((row) => {
      const income = Number(row[columns.B19013_001E]);
      if (!Number.isFinite(income) || income < 0) return [];

      return [{
        geoid: `${row[columns.state]}${row[columns.county]}`,
        name: row[columns.NAME],
        medianHouseholdIncome: income,
      }];
    });

    res.json({ year: 2024, count: counties.length, counties });
  } catch (error) {
    console.error("Economics incomeByCounty error:", error.message);
    res.status(error.response?.status || 502).json({
      error: error.response?.data?.error || error.message || "Failed to fetch Census income data",
    });
  }
});

router.get("/highIncomeHouseholdsByCounty", async (_req, res) => {
  const apiKey = requireEnv(res, "ECONOMY_KEY", "Economy API key");
  if (!apiKey) return;

  try {
    const response = await axios.get("https://api.census.gov/data/2024/acs/acs5", {
      params: {
        get: "NAME,B19001_001E,B19001_017E",
        for: "county:*",
        in: "state:*",
        key: apiKey,
      },
      timeout: 30000,
    });

    const rows = response.data;
    if (!Array.isArray(rows) || !Array.isArray(rows[0])) {
      return res.status(502).json({ error: "Unexpected response from Census API" });
    }

    const columns = Object.fromEntries(rows[0].map((name, index) => [name, index]));
    const requiredColumns = ["NAME", "B19001_001E", "B19001_017E", "state", "county"];
    if (requiredColumns.some((name) => columns[name] == null)) {
      return res.status(502).json({ error: "Census API response is missing required columns" });
    }

    const counties = rows.slice(1).flatMap((row) => {
      const totalHouseholds = Number(row[columns.B19001_001E]);
      const highIncomeHouseholds = Number(row[columns.B19001_017E]);
      const stateFips = row[columns.state];
      const countyFips = row[columns.county];
      const name = row[columns.NAME];
      if (
        !Number.isFinite(totalHouseholds)
        || totalHouseholds <= 0
        || !Number.isFinite(highIncomeHouseholds)
        || highIncomeHouseholds < 0
        || !/^\d{2}$/.test(stateFips)
        || !/^\d{3}$/.test(countyFips)
        || !name
      ) {
        return [];
      }

      return [{
        geoid: `${stateFips}${countyFips}`,
        name,
        highIncomeHouseholds,
        totalHouseholds,
        highIncomeHouseholdPercent: (highIncomeHouseholds / totalHouseholds) * 100,
      }];
    });

    return res.json({
      source: "U.S. Census Bureau — 2024 American Community Survey 5-Year Estimates, Table B19001",
      year: 2024,
      incomeThreshold: 200000,
      count: counties.length,
      counties,
    });
  } catch (error) {
    console.error("Economics highIncomeHouseholdsByCounty error:", error.message);
    return res.status(error.response?.status || 502).json({
      error: error.response?.data?.error || error.message || "Failed to fetch Census high-income household data",
    });
  }
});

router.get("/unemploymentByCounty", async (req, res) => {
  let dateRange;
  try {
    dateRange = parseCountyUnemploymentDateRange(req.query.start, req.query.end);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const blsApiKey = requireEnv(res, "BLS_API_KEY", "BLS API key");
  if (!blsApiKey) return;
  const censusApiKey = requireEnv(res, "ECONOMY_KEY", "Economy API key");
  if (!censusApiKey) return;

  const currentYear = new Date().getUTCFullYear();
  const startYear = dateRange?.startYear ?? currentYear - 1;
  const endYear = dateRange?.endYear ?? currentYear;
  const cacheKey = `${startYear}-${endYear}`;
  try {
    const cached = countyUnemploymentCache.get(cacheKey);
    let months = cached?.months;
    if (!months || Date.now() - cached.fetchedAt >= COUNTY_LAUS_CACHE_TTL) {
      let request = countyUnemploymentRequests.get(cacheKey);
      if (!request) {
        request = fetchCountyUnemployment(
          blsApiKey,
          censusApiKey,
          startYear,
          endYear,
        ).then((fetchedMonths) => {
          countyUnemploymentCache.set(cacheKey, {
            months: fetchedMonths,
            fetchedAt: Date.now(),
          });
          if (countyUnemploymentCache.size > COUNTY_LAUS_CACHE_MAX_ENTRIES) {
            countyUnemploymentCache.delete(countyUnemploymentCache.keys().next().value);
          }
          return fetchedMonths;
        }).finally(() => {
          countyUnemploymentRequests.delete(cacheKey);
        });
        countyUnemploymentRequests.set(cacheKey, request);
      }
      months = await request;
    }

    if (!dateRange) {
      if (!months.length) {
        throw new Error("BLS API returned no county unemployment-rate observations");
      }
      return res.json({
        source: "U.S. Bureau of Labor Statistics — Local Area Unemployment Statistics",
        ...latestCountyUnemploymentMonth(months),
      });
    }

    const requestedMonths = months.filter((month) => {
      const monthKey = `${month.year}-${month.period.slice(1)}`;
      return monthKey >= dateRange.start && monthKey <= dateRange.end;
    });
    return res.json({
      source: "U.S. Bureau of Labor Statistics — Local Area Unemployment Statistics",
      start: dateRange.start,
      end: dateRange.end,
      months: requestedMonths,
    });
  } catch (error) {
    console.error("Economics unemploymentByCounty error:", error.message);
    const upstreamMessage = error.response?.data?.message;
    const errorMessage = Array.isArray(upstreamMessage)
      ? upstreamMessage.join("; ")
      : typeof upstreamMessage === "string"
        ? upstreamMessage
        : error.message;
    return res.status(502).json({
      error: errorMessage || "Failed to fetch BLS county unemployment data",
    });
  }
});

export default router;
