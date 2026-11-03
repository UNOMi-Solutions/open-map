// Transportation datasets from the Bureau of Transportation Statistics (BTS).
import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import { Router } from "express";
import { getCached } from "../utils/dataCache.js";

const router = Router();

const SODA_ROOT = "https://data.bts.gov/resource";
const RURAL_ACCESS_DATASET = "m2bh-93w3";
const RURAL_ACCESS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // BTS republishes on a multi-year cycle

// Years present in the dataset
const RURAL_ACCESS_YEARS = [2006, 2012, 2018, 2021];
const RURAL_ACCESS_DEFAULT_YEAR = 2021;

/**
 * 2021 carries five rows per county: a 2018-population comparison row plus four
 * distance scenarios in the `var` column (NA, Minus 10 miles, Plus 10 miles,
 * Completely outside urban areas). We take the baseline: var='NA' on the
 * 2017-2021 ACS base. Earlier years have one row per county.
 */
const BASELINE_FILTER_2021 = `var='NA' AND popbase='ACS 2017-2021 5 year estimates'`;

// Socrata sends an app token only when configured and not a placeholder.
function socrataHeaders() {
  const token = process.env.SOCRATA_APP_TOKEN?.trim();
  if (!token || token.toLowerCase().startsWith("your-")) return {};
  return { "X-App-Token": token };
}

// BTS flag values: -999 = population not available, 998 = no rural population, 999 = NA.
const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n !== -999 ? n : null; // checks if -999
};
const toPercent = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n !== -999 && n !== 998 && n !== 999 ? n : null; // checks -999, 998, 999
};
// geoid is served as a float ("4019.0"); normalize to the 5-digit FIPS string
// that matches `id` on features in /geo/counties-10m.json.
const toFips = (v) => String(Math.trunc(Number(v))).padStart(5, "0");

/**
 * GET /api/v1/transportation/ruralAccess?year=2021
 * Returns Percent of rural population with access to scheduled intercity air, bus, and rail.
 */
router.get("/ruralAccess", async (req, res) => {
  const year = Number(req.query.year) || RURAL_ACCESS_DEFAULT_YEAR;
  if (!RURAL_ACCESS_YEARS.includes(year)) {
    return res.status(400).json({
      error: `Unsupported year ${year}. Available: ${RURAL_ACCESS_YEARS.join(", ")}`,
    });
  }

  const where = year === 2021 ? `year=2021 AND ${BASELINE_FILTER_2021}` : `year=${year}`;

  try {
    const rows = await getCached(`transportation:ruralAccess:${year}`, RURAL_ACCESS_TTL_MS, async () => {
      const response = await axios.get(`${SODA_ROOT}/${RURAL_ACCESS_DATASET}.json`, {
        params: {
          $select: "geoid,name,statepo,ruralpop,totpop,paccair,paccbus,paccrail,paccall,cntair,cntbus,cntrail,cntall",
          $where: where,
          $limit: 5000, // ~3,140 counties
        },
        headers: socrataHeaders(),
        timeout: 30000,
      });
      return response.data.map((d) => ({
        geoid: toFips(d.geoid),
        name: d.name,
        state: d.statepo,
        ruralpop: toNumber(d.ruralpop),
        totpop: toNumber(d.totpop),
        paccall: toPercent(d.paccall),
        paccair: toPercent(d.paccair),
        paccbus: toPercent(d.paccbus),
        paccrail: toPercent(d.paccrail),
        cntair: toNumber(d.cntair),
        cntbus: toNumber(d.cntbus),
        cntrail: toNumber(d.cntrail),
        cntall: toNumber(d.cntall),
      }));
    });

    res.json({
      year,
      availableYears: RURAL_ACCESS_YEARS,
      attribution: "US DOT Bureau of Transportation Statistics, Access to Intercity Air, Bus, and Rail Transportation in Rural Areas",
      sourceUrl: `https://data.bts.gov/d/${RURAL_ACCESS_DATASET}`,
      total: rows.length,
      rows,
    });
  } catch (err) {
    console.error("[transportation/ruralAccess]", err.message);
    res.status(502).json({ error: "Failed to fetch rural access data from BTS" });
  }
});

export default router;