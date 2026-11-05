// Import dotenv for hidden variables
import dotenv from "dotenv";
dotenv.config();

// Import Router so paths can be passed to index
import { response, Router } from "express";
const router = Router();

// Import axios
import axios from "axios";

// Import cheerio for web scraping
import * as cheerio from "cheerio";

// Import file stream and csv reader for missing person data
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { fileURLToPath } from "url";
import csvParser from "csv-parser";

import { getZipData } from "../utils/zipData.js";
import { getCached, mapWithConcurrency } from "../utils/dataCache.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MISSING_PERSONS_CSV = path.join(__dirname, "..", "data", "missingPersons.csv");
// Bundled snapshot of the Mother Jones sheet, used when Google Sheets is unreachable.
const MASS_SHOOTINGS_CSV = path.join(__dirname, "..", "data", "massShootings.csv");
const MASS_SHOOTINGS_SHEET_URL =
    "https://docs.google.com/spreadsheets/d/1b9o6uDO18sLxBqPwl_Gh9bnhW-ev_dABH83M5Vb5L8o/export?format=csv&gid=0";

// Test Command
router.get('/test', (req, res) => {
    const testResponse = { "response": "Success: Viewing Crime Data" };
    res.json(testResponse);
});


// Array of all state abbreviations
// Ensures separation of date for ease of parsing on map
const US_STATE_ABBREVIATIONS = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
    "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
    "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
    "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
];
// FBI CDE data is not always available for the current calendar year.
// Use a stable completed year by default, while still allowing ?year=YYYY.
const DEFAULT_CRIME_YEAR = "2023";

const FBI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
// The FBI API answers a full 50-state fan-out with 429s, but one-at-a-time made
// an uncached request take most of a minute and the browser gave up first.
const FBI_STATE_CONCURRENCY = 4;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchFbiUrl(url, retries = 4) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await axios.get(url);
            return response.data;
        } catch (error) {
            const status = error.response?.status;
            if (status === 429 && attempt < retries - 1) {
                await sleep(1500 * (attempt + 1));
                continue;
            }
            throw error;
        }
    }
}

/** Fetch states a few at a time, staying under FBI api.data.gov rate limits (429). */
async function fetchAllStates(buildUrl) {
    const entries = await mapWithConcurrency(
        US_STATE_ABBREVIATIONS,
        FBI_STATE_CONCURRENCY,
        async (state) => [state, await fetchFbiUrl(buildUrl(state))]
    );
    return Object.fromEntries(entries);
}

/** Reads the bundled missing persons CSV once per TTL instead of per request. */
function getMissingPersons() {
    return getCached("crime:missingPersons", FBI_CACHE_TTL_MS, async () => {
        const { byCounty } = await getZipData();

        return new Promise((resolve, reject) => {
            const rows = [];
            fs.createReadStream(MISSING_PERSONS_CSV)
                .pipe(csvParser())
                .on("data", (row) => {
                    row["locationData"] = byCounty[row["County"]];
                    rows.push(row);
                })
                .on("end", () => resolve(rows))
                .on("error", reject);
        });
    });
}

function parseCsv(stream) {
    return new Promise((resolve, reject) => {
        const rows = [];
        stream
            // The sheet has two columns named "location": city/state, then venue type.
            .pipe(csvParser({ mapHeaders: ({ header, index }) => (index === 7 ? "venue" : header.trim()) }))
            .on("data", (row) => rows.push(row))
            .on("end", () => resolve(rows))
            .on("error", reject);
    });
}

function toNumber(value) {
    const n = Number(String(value ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
}

function toText(value) {
    const text = String(value ?? "").trim();
    return text && text !== "-" ? text : null;
}

// Sheet spellings that don't match the zip-code dataset.
const MASS_SHOOTING_STATE_ALIASES = { "lousiana": "LA", "d.c.": "DC" };
const MASS_SHOOTING_CITY_ALIASES = {
    "manhattan|ny": "new york",
    "southport yacht basin|nc": "southport",
    "hedingham|nc": "raleigh",
};

function parseLocation(location, stateCodes) {
    const [city, state] = String(location ?? "").split(",").map((s) => s.trim());
    if (!state) return { city, stateCode: null };
    const key = state.toLowerCase();
    const stateCode = state.length === 2
        ? state.toUpperCase()
        : stateCodes[key] ?? MASS_SHOOTING_STATE_ALIASES[key] ?? null;
    return { city, stateCode };
}

/** Mother Jones stopped filling in coordinates in 2022, so fall back to the city's zip centroid. */
function locateCity(city, stateCode, byPlace) {
    if (!city || !stateCode) return null;
    const key = `${city}|${stateCode}`.toLowerCase();
    const row = byPlace[key] ?? byPlace[`${MASS_SHOOTING_CITY_ALIASES[key]}|${stateCode}`.toLowerCase()];
    return row ? { latitude: Number(row.latitude), longitude: Number(row.longitude) } : null;
}

function parseSheetDate(value, yearColumn) {
    const [month, day, rawYear] = String(value ?? "").split("/").map(Number);
    // Some rows use two-digit years ("5/24/22"); the separate year column is authoritative.
    const year = yearColumn || (rawYear < 100 ? 2000 + rawYear : rawYear);
    if (!month || !day || !year) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

function normalizeMassShooting(row, { byPlace, stateCodes }) {
    const year = toNumber(row.year);
    const { city, stateCode } = parseLocation(row.location, stateCodes);

    let latitude = toNumber(row.latitude);
    let longitude = toNumber(row.longitude);
    const approximate = !latitude || !longitude;
    if (approximate) {
        const cityMatch = locateCity(city, stateCode, byPlace);
        latitude = cityMatch?.latitude ?? null;
        longitude = cityMatch?.longitude ?? null;
    }

    return {
        name: toText(row.case),
        location: toText(row.location),
        state: stateCode,
        date: parseSheetDate(row.date, year),
        year,
        fatalities: toNumber(row.fatalities),
        injured: toNumber(row.injured),
        totalVictims: toNumber(row.total_victims),
        venue: toText(row.venue),
        summary: toText(row.summary),
        shooterAge: toText(row.age_of_shooter),
        shooterGender: toText(row.gender),
        weaponType: toText(row.weapon_type),
        weaponsObtainedLegally: toText(row.weapons_obtained_legally),
        type: toText(row.type),
        sources: (toText(row.sources) || "").split(/;\s*/).filter(Boolean),
        latitude,
        longitude,
        coordinatesApproximate: approximate && latitude != null,
    };
}

/** Mother Jones' public mass shootings database, refreshed from the live sheet once per TTL. */
function getMassShootings() {
    return getCached("crime:massShootings", FBI_CACHE_TTL_MS, async () => {
        const zipData = await getZipData();

        let rows;
        try {
            const response = await axios.get(MASS_SHOOTINGS_SHEET_URL, { responseType: "text", timeout: 15000 });
            rows = await parseCsv(Readable.from([response.data]));
            if (!rows.length || !("fatalities" in rows[0])) throw new Error("Unexpected sheet format");
        } catch (error) {
            console.warn("[crime] Mother Jones sheet unavailable, using bundled snapshot:", error.message);
            rows = await parseCsv(fs.createReadStream(MASS_SHOOTINGS_CSV));
        }

        return rows.map((row) => normalizeMassShooting(row, zipData)).filter((r) => r.name);
    });
}

/** Fills the slowest caches so the first visitor of a cold instance isn't the one who pays. */
export async function warmCrimeCache() {
    await getMissingPersons();
}

function hasValidFbiKey() {
    const key = process.env.FBI_CRIME_KEY?.trim();
    return key && !["your-", "replace-me", "changeme", "your_fbi_key_here"].some((p) =>
        key.toLowerCase().startsWith(p)
    );
}

function normalizeCrimeYear(year) {
    const value = String(year || DEFAULT_CRIME_YEAR);
    return /^\d{4}$/.test(value) ? value : DEFAULT_CRIME_YEAR;
}

function normalizeState(state) {
    const value = String(state || "").trim().toUpperCase();
    return US_STATE_ABBREVIATIONS.includes(value) ? value : null;
}

function handleFbiRouteError(res, error, label) {
    const status = error.response?.status;
    console.error(`[crime] ${label} failed:`, error.message);
    if (status === 429) {
        return res.status(429).json({
            success: false,
            message: "FBI crime API rate limit reached. Wait a minute and try again, or use cached production data.",
        });
    }
    return res.status(500).json({
        success: false,
        message: `Failed to fetch ${label} from FBI API: ${error}`,
    });
}

// Get general murder data for all states
// Takes in year as optional parameter, will output current year by default
router.get('/murderByState', async (req, res) => {
    if (!hasValidFbiKey()) {
        return res.status(503).json({
            success: false,
            message: "FBI_CRIME_KEY is not configured. Add a valid api.data.gov key to backend/.env and restart the server.",
        });
    }

    const year = normalizeCrimeYear(req.query.year);
    const requestedState = normalizeState(req.query.state);

    if (req.query.state && !requestedState) {
        return res.status(400).json({
            success: false,
            message: "Invalid state. Use a valid two-letter state abbreviation like AZ.",
        });
    }

    const cacheKey = requestedState ? `murder:${year}:${requestedState}` : `murder:${year}`;

    try {
        const murderJSON = await getCached(cacheKey, FBI_CACHE_TTL_MS, () =>
            requestedState
                ? fetchFbiUrl(`https://api.usa.gov/crime/fbi/cde/shr/state/${requestedState}?type=totals&from=01-${year}&to=12-${year}&API_KEY=${process.env.FBI_CRIME_KEY}`)
                : fetchAllStates((state) =>
                    `https://api.usa.gov/crime/fbi/cde/shr/state/${state}?type=totals&from=01-${year}&to=12-${year}&API_KEY=${process.env.FBI_CRIME_KEY}`,
                ),
        );
        
        res.json({
            success: true,
            source: "FBI Crime Data API",
            endpoint: "murderByState",
            year,
            state: requestedState || "all",
            data: murderJSON,
        });
        
    } catch (error) {
        handleFbiRouteError(res, error, "murderByState");
    }
});

const offenseCodes = {
  "all": "all",
  "310": "All Other Offenses (Except Traffic)",
  "110": "Arson",
  "60": "Burglary",
  "330": "Curfew and Loitering Law Violations",
  "290": "Disorderly Conduct",
  "260": "Driving Under the Influence",
  "150": "Drug Abuse Violations",
  "158": "Drug Possession - Marijuana",
  "157": "Drug Possession - Opium or Cocaine or Their Derivatives",
  "160": "Drug Possession - Other - Dangerous Nonnarcotic Drugs",
  "159": "Drug Possession - Synthetic Narcotics",
  "153": "Drug Sale/Manufacturing - Marijuana",
  "152": "Drug Sale/Manufacturing - Opium or Cocaine or Their Derivatives",
  "155": "Drug Sale/Manufacturing - Other - Dangerous Nonnarcotic Drugs",
  "154": "Drug Sale/Manufacturing - Synthetic Narcotics",
  "280": "Drunkenness",
  "200": "Embezzlement",
  "180": "Forgery and Counterfeiting",
  "190": "Fraud",
  "173": "Gambling - All Other Gambling",
  "171": "Gambling - Bookmaking (Horse and Sport Book)",
  "172": "Gambling - Numbers and Lottery",
  "170": "Gambling",
  "70": "Larceny - Theft",
  "270": "Liquor Law Violations",
  "12": "Manslaughter by Negligence",
  "90": "Motor Vehicle Theft",
  "11": "Murder and Nonnegligent Homicide",
  "250": "Offenses Against the Family and Children",
  "140": "Prostitution and Commercialized Vice",
  "142": "Prostitution and Commercialized Vice - Assisting or Promoting Prostitution",
  "141": "Prostitution and Commercialized Vice - Prostitution",
  "143": "Prostitution and Commercialized Vice - Purchasing Prostitution",
  "23": "Rape",
  "30": "Robbery",
  "240": "Sex Offenses (Except Rape, and Prostitution and Commercialized Vice)",
  "55": "Simple Assault",
  "210": "Stolen Property: Buying, Receiving, Possessing",
  "300": "Vagrancy",
  "220": "Vandalism",
  "230": "Weapons: Carrying, Possessing, Etc."
};

// Get general arrest data for all states
// Takes in year as optional parameter, will output current year by default
// Takes in offenseCode as optional parameter, will output all offenses if blank or invalid
router.get('/arrestsByState', async (req, res) => {
    if (!hasValidFbiKey()) {
        return res.status(503).json({
            success: false,
            message: "FBI_CRIME_KEY is not configured. Add a valid api.data.gov key to backend/.env and restart the server.",
        });
    }

    const year = normalizeCrimeYear(req.query.year);
    const requestedState = normalizeState(req.query.state);

    if (req.query.state && !requestedState) {
        return res.status(400).json({
            success: false,
            message: "Invalid state. Use a valid two-letter state abbreviation like AZ.",
        });
    }

    let offenseCode = req.query.offenseCode || "all";
    if (offenseCodes[offenseCode] == undefined) {
        offenseCode = "all";
    }

    const cacheKey = requestedState
        ? `arrests:${year}:${offenseCode}:${requestedState}`
        : `arrests:${year}:${offenseCode}`;

    try {
        const arrestsJSON = await getCached(cacheKey, FBI_CACHE_TTL_MS, () =>
            requestedState
                ? fetchFbiUrl(`https://api.usa.gov/crime/fbi/cde/arrest/state/${requestedState}/${offenseCode}?type=totals&from=01-${year}&to=12-${year}&API_KEY=${process.env.FBI_CRIME_KEY}`)
                : fetchAllStates((state) =>
                    `https://api.usa.gov/crime/fbi/cde/arrest/state/${state}/${offenseCode}?type=totals&from=01-${year}&to=12-${year}&API_KEY=${process.env.FBI_CRIME_KEY}`,
                ),
        );

        res.json({
            success: true,
            source: "FBI Crime Data API",
            endpoint: "arrestsByState",
            year,
            state: requestedState || "all",
            offenseCode,
            offenseLabel: offenseCodes[offenseCode],
            data: arrestsJSON,
        });
    } catch (error) {
        handleFbiRouteError(res, error, "arrestsByState");
    }
});

// Get national missing person data
// Taken from https://www.fbi.gov/wanted/kidnap
router.get('/missingPersons', async (req, res) => {
    try {
        res.json(await getMissingPersons());
    } catch (error) {
        console.error("Error reading CSV file:", error);
        res.status(500).json({ error: "Error reading CSV file" });
    }
});

// Get US mass shootings, 1982 to present
// Taken from Mother Jones: https://www.motherjones.com/politics/2012/12/mass-shootings-mother-jones-full-data/
router.get('/massShootings', async (req, res) => {
    try {
        const incidents = await getMassShootings();
        res.json({
            success: true,
            source: "Mother Jones US Mass Shootings Database",
            sourceUrl: "https://www.motherjones.com/politics/2012/12/mass-shootings-mother-jones-full-data/",
            count: incidents.length,
            data: incidents,
        });
    } catch (error) {
        console.error("[crime] massShootings failed:", error.message);
        res.status(500).json({ success: false, message: "Failed to load mass shooting data" });
    }
});

export default router;