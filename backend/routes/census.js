import dotenv from "dotenv";
dotenv.config();

import { Router } from "express";
import axios from "axios";
import { requireEnv } from "../lib/requireEnv.js";

const router = Router();

const CENSUS_YEAR = "2024";
const CENSUS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const censusCache = new Map();
const inFlightFetches = new Map();

const RACE_VARIABLES = {
  total: "B02001_001E",
  white: "B02001_002E",
  black: "B02001_003E",
  nativeAmerican: "B02001_004E",
  asian: "B02001_005E",
  mixed: "B02001_008E",
  hispanic: "B03003_003E",
  arab: "B04006_006E",
};

const EAST_ASIAN_VARIABLES = [
  "B02015_002E",
  "B02015_003E",
  "B02015_004E",
  "B02015_005E",
  "B02015_006E",
  "B02015_007E",
  "B02015_008E",
  "B02015_009E",
];

router.get("/test", (req, res) => {
  res.json({ response: "Success: Viewing Census Data" });
});

function readCache(key) {
  const entry = censusCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CENSUS_CACHE_TTL_MS) {
    censusCache.delete(key);
    return null;
  }
  return entry.data;
}

function writeCache(key, data) {
  censusCache.set(key, { data, cachedAt: Date.now() });
}

async function getCachedCensusData(cacheKey, fetchFn) {
  const cached = readCache(cacheKey);
  if (cached) return cached;

  if (inFlightFetches.has(cacheKey)) {
    return inFlightFetches.get(cacheKey);
  }

  const promise = fetchFn()
    .then((data) => {
      writeCache(cacheKey, data);
      inFlightFetches.delete(cacheKey);
      return data;
    })
    .catch((error) => {
      inFlightFetches.delete(cacheKey);
      throw error;
    });

  inFlightFetches.set(cacheKey, promise);
  return promise;
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asPercent(value, total) {
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.round((value / total) * 10000) / 100;
}

async function fetchCountyRaceData(apiKey) {
  const variables = [
    ...Object.values(RACE_VARIABLES),
    ...EAST_ASIAN_VARIABLES,
  ].join(",");
  const response = await axios.get(
    `https://api.census.gov/data/${CENSUS_YEAR}/acs/acs5`,
    {
      params: {
        get: `NAME,${variables}`,
        for: "county:*",
        in: "state:*",
        key: apiKey,
      },
      timeout: 20000,
    }
  );

  const rows = response.data;
  if (!Array.isArray(rows) || rows.length < 2 || !Array.isArray(rows[0])) {
    throw new Error("Unexpected Census API response");
  }

  const headers = rows[0];
  const indexOf = (name) => headers.indexOf(name);
  const requiredHeaders = [
    "NAME",
    ...Object.values(RACE_VARIABLES),
    ...EAST_ASIAN_VARIABLES,
    "state",
    "county",
  ];

  for (const header of requiredHeaders) {
    if (indexOf(header) === -1) {
      throw new Error(`Census API response is missing ${header}`);
    }
  }

  const counties = {};

  for (const row of rows.slice(1)) {
    const state = String(row[indexOf("state")] ?? "").padStart(2, "0");
    const county = String(row[indexOf("county")] ?? "").padStart(3, "0");
    if (!state || !county) continue;

    const geoid = `${state}${county}`;
    const total = asNumber(row[indexOf(RACE_VARIABLES.total)]);
    const white = asNumber(row[indexOf(RACE_VARIABLES.white)]);
    const black = asNumber(row[indexOf(RACE_VARIABLES.black)]);
    const hispanic = asNumber(row[indexOf(RACE_VARIABLES.hispanic)]);
    const asian = asNumber(row[indexOf(RACE_VARIABLES.asian)]);
    const nativeAmerican = asNumber(row[indexOf(RACE_VARIABLES.nativeAmerican)]);
    const mixed = asNumber(row[indexOf(RACE_VARIABLES.mixed)]);
    const arab = asNumber(row[indexOf(RACE_VARIABLES.arab)]);
    const eastAsian = EAST_ASIAN_VARIABLES.reduce(
      (sum, variable) => sum + asNumber(row[indexOf(variable)]),
      0
    );

    counties[geoid] = {
      name: row[indexOf("NAME")],
      state,
      county,
      total,
      counts: {
        white,
        black,
        hispanic,
        asian,
        nativeAmerican,
        mixed,
        eastAsian,
        arab,
      },
      percentages: {
        white: asPercent(white, total),
        black: asPercent(black, total),
        hispanic: asPercent(hispanic, total),
        asian: asPercent(asian, total),
        nativeAmerican: asPercent(nativeAmerican, total),
        mixed: asPercent(mixed, total),
        eastAsian: asPercent(eastAsian, total),
        arab: asPercent(arab, total),
      },
    };
  }

  return {
    source: "U.S. Census Bureau, American Community Survey 5-Year Estimates",
    year: CENSUS_YEAR,
    geography: "county",
    definitions: {
      white: "White alone (B02001_002E)",
      black: "Black or African American alone (B02001_003E)",
      hispanic: "Hispanic or Latino ethnicity (B03003_003E)",
      asian: "Asian alone (B02001_005E)",
      nativeAmerican: "American Indian and Alaska Native alone (B02001_004E)",
      mixed: "Two or more races (B02001_008E)",
      eastAsian: "Sum of ACS East Asian selected groups (B02015_002E through B02015_009E)",
      arab: "People reporting Arab ancestry (B04006_006E)",
    },
    count: Object.keys(counties).length,
    counties,
  };
}

router.get("/race", async (req, res) => {
  const apiKey = requireEnv(res, "CENSUS_API_KEY", "Census API key");
  if (!apiKey) return;

  try {
    const data = await getCachedCensusData(`race-${CENSUS_YEAR}`, () =>
      fetchCountyRaceData(apiKey)
    );
    res.json(data);
  } catch (error) {
    const status = error.response?.status;
    console.error("[census] race data failed:", error.message);

    if (status === 429) {
      return res.status(429).json({
        success: false,
        message: "Census API rate limit reached. Try again shortly.",
      });
    }

    res.status(status && status >= 400 && status < 600 ? status : 500).json({
      success: false,
      message: "Failed to fetch Census race data",
    });
  }
});

export default router;
