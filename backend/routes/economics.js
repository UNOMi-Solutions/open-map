import axios from "axios";
import { Router } from "express";
import { requireEnv } from "../lib/requireEnv.js";
import { getSNP500Companies } from "../lib/s&p500.js";
import { getUsBillionaireProfiles } from "../lib/rtbBillionaires.js";

const router = Router();

router.get("/test", (req, res) => {
  res.json({ response: "Success: Viewing Economic Data" });
});

router.get("/sp500", async (req, res) => {
  const companies = await getSNP500Companies();
  res.json({ count: companies.length, companies });
});

router.get("/billionaires", async (req, res) => {
  try {
    const profiles = await getUsBillionaireProfiles();
    return res.json({ count: profiles.length, profiles });
  } catch (error) {
    console.error("GET /economics/billionaires error:", error.message);
    return res.status(502).json({ error: "Failed to retrieve U.S. billionaire profiles" });
  }
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

export default router;
