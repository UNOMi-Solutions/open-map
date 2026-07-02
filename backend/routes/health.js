import axios from "axios";
import { Router } from "express";
import mongoose from "mongoose";

const router = Router();
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
