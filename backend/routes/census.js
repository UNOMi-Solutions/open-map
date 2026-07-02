import axios from "axios";
import { Router } from "express";
import { requireEnv } from "../lib/requireEnv.js";

const router = Router();

router.get("/test", (req, res) => {
  res.json({ response: "Success: Viewing Census Data" });
});

/**
 * State population estimates from U.S. Census Bureau PEP API.
 * Requires CENSUS_API_KEY — https://api.census.gov/data/key_signup.html
 */
router.get("/populationByState", async (req, res) => {
  const apiKey = requireEnv(res, "CENSUS_API_KEY", "Census API key");
  if (!apiKey) return;

  const year = (req.query.year || "2023").toString().trim();

  try {
    const response = await axios.get(
      `https://api.census.gov/data/${year}/pep/population`,
      {
        params: {
          get: "NAME,POP",
          for: "state:*",
          key: apiKey,
        },
      }
    );

    const rows = response.data;
    if (!Array.isArray(rows) || rows.length < 2) {
      return res.status(502).json({ error: "Unexpected response from Census API" });
    }

    const [headers, ...dataRows] = rows;
    const nameIdx = headers.indexOf("NAME");
    const popIdx = headers.findIndex((h) => h === "POP" || h.startsWith("POP_"));
    const stateIdx = headers.indexOf("state");

    const states = dataRows.map((row) => ({
      name: row[nameIdx],
      population: Number(row[popIdx]),
      stateFips: row[stateIdx],
      stateCode: fipsToState(row[stateIdx]),
    }));

    res.json({
      source: "U.S. Census Bureau Population Estimates Program",
      year,
      count: states.length,
      states,
    });
  } catch (error) {
    console.error("Census populationByState error:", error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message || "Failed to fetch census data",
    });
  }
});

/** FIPS → USPS state code (50 states + DC). */
function fipsToState(fips) {
  const map = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT",
    "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL",
    "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
    "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE",
    "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
    "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
    "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
    "55": "WI", "56": "WY",
  };
  return map[fips?.padStart(2, "0")] || null;
}

export default router;
