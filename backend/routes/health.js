import axios from "axios";
import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

const FIFTY_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL",
  "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT",
  "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

const US_STATE_NAMES = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

// helper functions
function getCdcHeaders() {
  const token = process.env.HEALTHDATA_API_KEY?.trim();

  return token ? { "X-App-Token": token } : {};
}
async function fetchCdcData(datasetId, params = {}) {
  const response = await axios.get(
    `https://data.cdc.gov/resource/${datasetId}.json`,
    {
      params,
      headers: getCdcHeaders(),
    }
  );

  return response.data;
}


router.get("/test", (req, res) => {
  res.json({ response: "Success: Viewing Health Data" });
});

/**
 * Uninsured rate by state from CDC PLACES (SODA API).
 * Optional HEALTHDATA_API_KEY improves rate limits — https://data.cdc.gov/profile/edit/developer_settings
 */
router.get("/uninsuredRateByState", async (req, res) => {
  const rawToken = process.env.HEALTHDATA_API_KEY?.trim();
  const appToken =
    rawToken && !["your-", "replace-me", "changeme"].some((p) => rawToken.toLowerCase().startsWith(p))
      ? rawToken
      : null;

  try {
    const response = await axios.get(
      "https://data.cdc.gov/resource/i46a-9kgh.json",
      {
        params: {
          $select: "stateabbr, max(statedesc) as stateName, round(avg(access2_crudeprev), 1) as uninsuredPercent",
          $where: "access2_crudeprev IS NOT NULL",
          $group: "stateabbr",
          $order: "stateabbr ASC",
          $limit: 60,
        },
        headers: appToken ? { "X-App-Token": appToken } : {},
      }
    );

    const rows = response.data;
    if (!Array.isArray(rows)) {
      return res.status(502).json({ error: "Unexpected response from CDC Data API" });
    }

const cdcByState = new Map(
  rows
    .filter((row) => row.stateabbr)
    .map((row) => [
      row.stateabbr,
      {
        stateName: row.stateName,
        uninsuredPercent: Number(row.uninsuredPercent),
      },
    ])
);

if (cdcByState.size === 0) {
  return res.status(404).json({
    error: "No uninsured-rate data returned from CDC",
  });
}

const states = Object.entries(US_STATE_NAMES).map(
  ([state, fallbackName]) => {
    const row = cdcByState.get(state);

    return {
      state,
      stateName: row?.stateName ?? fallbackName,
      uninsuredPercent: row?.uninsuredPercent ?? null,
      dataAvailable: Boolean(row),
    };
  }
);

    const missingStates = states
      .filter((state) => !state.dataAvailable)
      .map((state) => state.state);

    res.json({
      source: "CDC PLACES — Current lack of health insurance (access2_crudeprev)",
      indicator: "Current lack of health insurance among adults",
      count: states.length,
      availableCount: states.length - missingStates.length,
      missingStates,
      states,
    });
  } catch (error) {
    console.error("Health uninsuredRateByState error:", error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message || "Failed to fetch health data",
    });
  }
});


// NEW FUNCTIONS
router.get("/prostateCancerByState", async (req, res) => {
  try {
    const measureId = 962; // 962 = prostate cancer code
    const geographicTypeId = 1; // 1 = state, need to look for county
    const temporalTypeId = 1;

    // Year supplied by frontend
    const year = req.query.year;

    const url =
      "https://ephtracking.cdc.gov/apigateway/api/v1/getCoreHolder/" +
      `${measureId}/${geographicTypeId}/all/all/` +
      `${temporalTypeId}/${year}/0/0`;

    const response = await axios.get(url);

    const rows = response.data.tableResult ?? [];

    if (rows.length === 0) {
      return res.status(404).json({
        error: `No colon cancer data found for ${year}`,
      });
    }

    const states = rows
      .map((row) => ({
        state: row.geo,
        stateFips: row.geoId,
        year: Number(row.temporal),
        prostateCancerCases:
          row.dataValue !== null && row.dataValue !== ""
            ? Number(row.dataValue)
            : null,
      }))
      .sort((a, b) => a.state.localeCompare(b.state));

    res.json({
      source: "CDC Environmental Public Health Tracking Network",
      indicator: "Annual Number of Cases of Colon Cancer",
      measureId,
      geographicLevel: "State",
      year: Number(year),
      count: states.length,
      states,
    });
  } catch (error) {
    console.error(
      "Colon cancer data error:",
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      error:
        error.response?.data?.message ||
        error.message ||
        "Failed to retrieve colon cancer data",
    });
  }
});

// ONLY HAS YEARS 2019-2022
router.get("/heartDiseaseByState", async (req, res) => {
  try {
    const year = req.query.year;

    const params = new URLSearchParams({
      "$select":
        "locationdesc,locationabbr,locationid,yearstart,datavalue",
      "$where": [
        `yearstart='${year}'`,
        `question='Diseases of the heart mortality among all people, underlying cause'`,
        `datavaluetype='Number'`,
        `stratification1='Overall'`,
      ].join(" AND "),
      "$order": "locationdesc ASC",
    });

    const url =
      `https://data.cdc.gov/resource/hksd-2xuw.json?${params}`;

    const headers = {};

    // Optional CDC Socrata application token
    if (process.env.HEALTHDATA_API_KEY) {
      headers["X-App-Token"] = process.env.HEALTHDATA_API_KEY;
    }

    const response = await axios.get(url, {
      headers,
    });

    const states = response.data
      .filter((row) => row.locationabbr !== "US")
      .map((row) => ({
        state: row.locationdesc,
        stateAbbreviation: row.locationabbr,
        stateFips: row.locationid,
        heartDiseaseDeaths:
          row.datavalue !== null && row.datavalue !== ""
            ? Number(row.datavalue)
            : null,
      }));

    if (states.length === 0) {
      return res.status(404).json({
        error: `No heart disease data found for ${year}`,
      });
    }

    res.json({
      source: "CDC U.S. Chronic Disease Indicators",
      indicator:
        "Diseases of the heart mortality among all people, underlying cause",
      year: Number(year),
      unit: "Number of deaths",
      count: states.length,
      states,
    });
  } catch (error) {
    console.error(
      "Heart disease data error:",
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      error: "Failed to retrieve heart disease data",
    });
  }
});

// ONLY HAS YEARS 2019-2022
router.get("/obesityByState", async (req, res) => {
  try {
    const year = req.query.year;

    if (!year) {
      return res.status(400).json({
        error: "Year is required",
      });
    }

    const params = new URLSearchParams({
  "$select":
    "locationdesc,locationabbr,locationid,yearstart,datavalue,datavaluetype,question,stratification1",
  "$where": [
    `yearstart=${Number(year)}`,
    `topic='Nutrition, Physical Activity, and Weight Status'`,
    `lower(question) like '%obesity%'`,
    `stratification1='Overall'`
  ].join(" AND "),
  "$order": "locationdesc ASC",
  "$limit": "5000"
});

    const url =
      `https://data.cdc.gov/resource/hksd-2xuw.json?${params}`;

    const headers = {};

    if (process.env.HEALTHDATA_API_KEY) {
      headers["X-App-Token"] = process.env.HEALTHDATA_API_KEY;
    }

    const response = await axios.get(url, { headers });

    const states = response.data
      .filter(row => row.locationabbr !== "US")
      .map(row => ({
        state: row.locationdesc,
        stateAbbreviation: row.locationabbr,
        stateFips: row.locationid,
        obesityPercent:
          row.datavalue !== null && row.datavalue !== ""
            ? Number(row.datavalue)
            : null
      }));

    if (states.length === 0) {
      return res.status(404).json({
        error: `No obesity data found for ${year}`
      });
    }

    res.json({
      source: "CDC U.S. Chronic Disease Indicators",
      indicator: "Adult Obesity",
      year: Number(year),
      unit: "Percent",
      count: states.length,
      states
    });

  } catch (error) {
    console.error(
      "Obesity data error:",
      error.response?.data || error.message
    );

    res.status(error.response?.status || 500).json({
      error: "Failed to retrieve obesity data"
    });
  }
});



/** Setup / diagnostics — shows which env vars are configured (never exposes values). */
router.get("/status", (req, res) => {
  res.json({
    success: true,
    service: "openmap-backend",
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    config: {
      API_DEV_KEY: Boolean(process.env.API_DEV_KEY),
      MONGODB_URI: Boolean(process.env.MONGODB_URI),
      CENSUS_API_KEY: Boolean(process.env.CENSUS_API_KEY),
      BEA_API_KEY: Boolean(process.env.BEA_API_KEY),
      HEALTHDATA_API_KEY: Boolean(process.env.HEALTHDATA_API_KEY),
      FBI_CRIME_KEY: Boolean(process.env.FBI_CRIME_KEY),
      EIA_API_KEY: Boolean(process.env.EIA_API_KEY),
      AQICN_API_TOKEN: Boolean(process.env.AQICN_API_TOKEN),
      RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
      JWT_SECRET: Boolean(process.env.JWT_SECRET),
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
    },
    endpoints: {
      ping: "GET /api/v1/health/ping (no API key)",
      status: "GET /api/v1/health/status (requires x-api-key)",
      categories: [
        "/api/v1/census",
        "/api/v1/crime",
        "/api/v1/economics",
        "/api/v1/environment",
        "/api/v1/health",
        "/api/v1/lawEnforcement",
        "/api/v1/politics",
        "/api/v1/social",
      ],
    },
  });
});


export default router;
