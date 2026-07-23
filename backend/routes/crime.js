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
import csvParser from "csv-parser";

// Get coords for counties
const countyCoords = {};
fs.createReadStream("./data/USZipsWithLatLon_20231227.csv")
  .pipe(csvParser())
  .on("data", (data) => {
    countyCoords[data["admin name2"]] = data;
  })
  .on("end", () => {
    console.log("CSV file successfully processed");
  })
  .on("error", (error) => {
    console.error("Error reading CSV file:", error);
  });

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
const FBI_STATE_DELAY_MS = 300;
const murderCache = new Map();
const arrestCache = new Map();
const inFlightFetches = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readCache(cache, key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > FBI_CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

function writeCache(cache, key, data) {
    cache.set(key, { data, cachedAt: Date.now() });
}

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

/** Fetch one state at a time to avoid FBI api.data.gov rate limits (429). */
async function fetchAllStatesSequentially(buildUrl) {
    const result = {};
    for (const state of US_STATE_ABBREVIATIONS) {
        result[state] = await fetchFbiUrl(buildUrl(state));
        await sleep(FBI_STATE_DELAY_MS);
    }
    return result;
}

async function getCachedFbiData(cacheKey, cache, fetchFn) {
    const cached = readCache(cache, cacheKey);
    if (cached) return cached;

    if (inFlightFetches.has(cacheKey)) {
        return inFlightFetches.get(cacheKey);
    }

    const promise = fetchFn()
        .then((data) => {
            writeCache(cache, cacheKey, data);
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
        message: `Failed to fetch ${label} from FBI API`,
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
        const murderJSON = await getCachedFbiData(cacheKey, murderCache, () =>
            requestedState
                ? fetchFbiUrl(`https://api.usa.gov/crime/fbi/cde/shr/state/${requestedState}?type=totals&from=01-${year}&to=12-${year}&API_KEY=${process.env.FBI_CRIME_KEY}`)
                : fetchAllStatesSequentially((state) =>
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
        const arrestsJSON = await getCachedFbiData(cacheKey, arrestCache, () =>
            requestedState
                ? fetchFbiUrl(`https://api.usa.gov/crime/fbi/cde/arrest/state/${requestedState}/${offenseCode}?type=totals&from=01-${year}&to=12-${year}&API_KEY=${process.env.FBI_CRIME_KEY}`)
                : fetchAllStatesSequentially((state) =>
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
    let missingPersons = [];

    try {
        fs.createReadStream("data/missingPersons.csv")
        .pipe(csvParser())
        .on("data", (row) => {
            // Process each row of the CSV file here
            // For example, you can push it to an array or directly send it as a response
            // console.log(row); // This will log each row as an object
            row["locationData"] = countyCoords[row["County"]];
            missingPersons.push(row);
        })
        .on("end", () => {
            //console.log("CSV file successfully processed");
            //console.log(missingPersons); // This will log the entire array of missing persons
            // You can send the processed data as a response here if needed
            res.json(missingPersons);
        })
        .on("error", (error) => {
            console.error("Error reading CSV file:", error);
            res.status(500).json({ error: "Error reading CSV file" });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error });
    }
});

export default router;