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
    const testResponse = { "response": "Success: Viewing Political Data" };
    res.json(testResponse);
})

// Array of all state abbreviations
// Ensures separation of date for ease of parsing on map
const US_STATE_ABBREVIATIONS = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
    "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
    "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
    "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
];

const currentDate = new Date();
const currentYear = currentDate.getFullYear();

const POLITICS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const POLITICS_STATE_DELAY_MS = 300;

const censusCache = new Map();
const inFlightFetches = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readCache(cache, key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > POLITICS_CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

function writeCache(cache, key, data) {
    cache.set(key, { data, cachedAt: Date.now() });
}

async function fetchPoliticsUrl(url, retries = 4) {
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

/** Fetch one state at a time to avoid api.data.gov rate limits (429). 
 * Note: not positive if census data rates are different, keeping same for now
*/
async function fetchAllStatesSequentially(buildUrl) {
    const result = {};
    for (const state of US_STATE_ABBREVIATIONS) {
        result[state] = await fetchFbiUrl(buildUrl(state));
        await sleep(POLITICS_STATE_DELAY_MS);
    }
    return result;
}

async function getCachedPoliticsData(cacheKey, cache, fetchFn) {
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

function handlePoliticsRouteError(res, error, label) {
    const status = error.response?.status;
    console.error(`[crime] ${label} failed:`, error.message);
    if (status === 429) {
        return res.status(429).json({
            success: false,
            message: "Political API rate limit reached. Wait a minute and try again, or use cached production data.",
        });
    }
    return res.status(500).json({
        success: false,
        message: `Failed to fetch ${label} from Politics API`,
    });
}

// this is all the basic setup, now for the hard part
// router.get functions for each data point
// need to get API key and look into gov site for router endpoints to get needed points

export default router;