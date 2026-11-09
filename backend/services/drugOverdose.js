import axios from "axios";
import Papa from "papaparse";
import { getCached } from "../utils/dataCache.js";

export const OVERDOSE_API_URL = "https://data.cdc.gov/resource/gb4e-yj24.json";
export const OVERDOSE_SOURCE_URL = "https://www.cdc.gov/nchs/nvss/vsrr/prov-county-drug-overdose.htm";
export const POPULATION_URL = "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/totals/co-est2025-alldata.csv";
export const POPULATION_SOURCE_URL = "https://www.census.gov/data/datasets/time-series/demo/popest/2020s-counties-total.html";
const DAY = 24 * 60 * 60 * 1000;

export function isOverdosePeriod(value) {
  return typeof value === "string" && /^(20\d{2})-(0[1-9]|1[0-2])$/.test(value);
}

function numberOrNull(value, max = Infinity) {
  if (!["number", "string"].includes(typeof value) || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= max ? number : null;
}

async function fetchCdcJson(params) {
  const token = process.env.HEALTHDATA_API_KEY?.trim();
  const usableToken = token && !/^(your-|replace-me|changeme)/i.test(token);
  const { data } = await axios.get(OVERDOSE_API_URL, {
    params, headers: usableToken ? { "X-App-Token": token } : {}, timeout: 30000,
  });
  if (!Array.isArray(data)) throw new Error("Invalid CDC overdose response.");
  return data;
}

export async function fetchOverdosePeriods(fetchJson = fetchCdcJson) {
  const rows = await fetchJson({
    $select: "monthendingdate,max(data_as_of) as data_as_of,count(*) as counties",
    $group: "monthendingdate", $order: "monthendingdate DESC", $limit: 1000,
  });
  if (!Array.isArray(rows) || !rows.length || rows.length >= 1000) throw new Error("CDC reporting periods are unavailable or incomplete.");
  const periods = rows.map((row) => {
    const period = String(row.monthendingdate || "").slice(0, 7);
    const count = numberOrNull(row.counties);
    if (!isOverdosePeriod(period) || !Number.isInteger(count) || count < 1 || !/^\d{4}-\d{2}-\d{2}T/.test(row.monthendingdate) || !/^\d{4}-\d{2}-\d{2}T/.test(row.data_as_of)) {
      throw new Error("CDC returned an invalid reporting period.");
    }
    return { period, endDate: row.monthendingdate, dataAsOf: row.data_as_of.slice(0, 10), count };
  });
  if (new Set(periods.map((row) => row.period)).size !== periods.length) throw new Error("Duplicate CDC reporting periods.");
  return periods.sort((a, b) => b.period.localeCompare(a.period));
}

export function parseCountyPopulations(csv) {
  if (typeof csv !== "string") throw new Error("Invalid Census population file.");
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  const years = (parsed.meta.fields || []).filter((field) => /^POPESTIMATE20\d{2}$/.test(field)).map((field) => Number(field.slice(-4))).sort();
  if (parsed.errors.length || !years.length) throw new Error("Invalid Census population table.");
  const counties = new Map();
  const names = new Map();
  for (const row of parsed.data) {
    if (Number(row.SUMLEV) !== 50) continue;
    const fips = `${String(row.STATE).padStart(2, "0")}${String(row.COUNTY).padStart(3, "0")}`;
    if (!/^\d{5}$/.test(fips) || fips.endsWith("000")) continue;
    const byYear = {};
    for (const year of years) {
      const population = numberOrNull(row[`POPESTIMATE${year}`]);
      if (Number.isInteger(population) && population > 0) byYear[year] = population;
    }
    counties.set(fips, byYear);
    names.set(fips, String(row.CTYNAME || fips));
  }
  if (!counties.size) throw new Error("Census population table contains no counties.");
  return { years, counties, names };
}

async function getCountyPopulations() {
  return getCached("health:overdose:population:v2025", 7 * DAY, async () => {
    const { data } = await axios.get(POPULATION_URL, { responseType: "text", timeout: 30000 });
    return parseCountyPopulations(data);
  });
}

export function normalizeOverdoseCounty(row, period, populations) {
  if (!row || typeof row !== "object" || String(row.monthendingdate || "").slice(0, 7) !== period) return null;
  const rawFips = String(row.fips || "");
  if (!/^\d{4,5}$/.test(rawFips)) return null;
  const fips = rawFips.padStart(5, "0");
  if (fips.endsWith("000")) return null;
  const rawCount = numberOrNull(row.provisional_drug_overdose);
  const reported = Number.isInteger(rawCount) && (rawCount === 0 || rawCount >= 10);
  const suppressed = !reported && (/suppress/i.test(String(row.footnote || "")) || (rawCount !== null && rawCount >= 1 && rawCount <= 9));
  const count = reported ? rawCount : null;
  // Use the ending-year population, or the latest published year if not yet available.
  const populationYear = populations.years.filter((year) => year <= Number(period.slice(0, 4))).at(-1) ?? null;
  const population = populationYear === null ? null : populations.counties.get(fips)?.[populationYear] ?? null;
  return {
    fips, name: populations.names?.get(fips) || String(row.countyname || fips), state: String(row.st_abbrev || ""),
    count, countStatus: reported ? "reported" : suppressed ? "suppressed" : "unavailable",
    rate: count !== null && population > 0 ? count / population * 100000 : null,
    population, populationYear,
    pendingPercent: numberOrNull(row.percentage_of_records_pending, 100),
    completenessNote: String(row.historicaldatacompletenessnote || ""),
    dataAsOf: String(row.data_as_of || "").slice(0, 10),
    dataNote: "",
  };
}

export async function fetchOverdoseCounties(reportingPeriod, populations, fetchJson = fetchCdcJson) {
  const counties = new Map();
  let offset = 0;
  let excludedCountyCount = 0;
  let duplicateCountyRecords = 0;
  while (offset < reportingPeriod.count) {
    const rows = await fetchJson({
      $where: `monthendingdate='${reportingPeriod.endDate}'`,
      $order: "fips ASC,countyname ASC", $limit: 1000, $offset: offset,
    });
    if (!Array.isArray(rows) || !rows.length || rows.length > 1000 || offset + rows.length > reportingPeriod.count) throw new Error("CDC returned an incomplete or changing county snapshot.");
    for (const row of rows) {
      if (String(row.data_as_of || "").slice(0, 10) !== reportingPeriod.dataAsOf || String(row.monthendingdate || "") !== reportingPeriod.endDate) throw new Error("CDC returned a mixed reporting snapshot.");
      const county = normalizeOverdoseCounty(row, reportingPeriod.period, populations);
      if (!county) { excludedCountyCount += 1; continue; }
      const existing = counties.get(county.fips);
      if (existing) {
        duplicateCountyRecords += 1;
        // CDC includes retired Virginia city aliases under current county FIPS.
        // Identical measurements are one record; conflicting measurements stay unavailable.
        if (existing.count !== county.count || existing.countStatus !== county.countStatus || existing.dataNote) {
          existing.count = null;
          existing.rate = null;
          existing.countStatus = "unavailable";
          existing.dataNote = "CDC contains conflicting records for this county identifier; no count or rate is displayed.";
        }
        if (existing.pendingPercent !== county.pendingPercent) existing.pendingPercent = null;
        if (county.completenessNote && !existing.completenessNote.includes(county.completenessNote)) existing.completenessNote += ` ${county.completenessNote}`;
        continue;
      }
      counties.set(county.fips, county);
    }
    offset += rows.length;
  }
  return { counties: Array.from(counties.values()), excludedCountyCount, duplicateCountyRecords };
}

export async function getDrugOverdoseDeaths(requestedPeriod = "latest") {
  const periods = await getCached("health:overdose:periods:v1", DAY, () => fetchOverdosePeriods());
  const period = requestedPeriod === "latest" ? periods[0].period : requestedPeriod;
  const selected = periods.find((entry) => entry.period === period);
  if (!selected) throw Object.assign(new Error("CDC has no data for this reporting period."), { status: 404 });
  const data = await getCached(`health:overdose:counties:${period}:${selected.dataAsOf}:v1`, DAY, async () => {
    const populations = await getCountyPopulations();
    return fetchOverdoseCounties(selected, populations);
  });
  return {
    source: "CDC/NCHS National Vital Statistics System", sourceUrl: OVERDOSE_SOURCE_URL,
    populationSourceUrl: POPULATION_SOURCE_URL, refreshFrequency: "quarterly",
    period, availablePeriods: periods.map((entry) => entry.period), dataAsOf: selected.dataAsOf,
    retrievedAt: new Date().toISOString(), rateDefinition: "Crude deaths per 100,000 residents; not age-adjusted",
    ...data,
  };
}
