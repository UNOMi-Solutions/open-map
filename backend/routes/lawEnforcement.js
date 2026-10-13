// Import dotenv for hidden variables
import dotenv from "dotenv";
dotenv.config();

// Import Router so paths can be passed to index
import { Router } from "express";
const router = Router();

// Import axios
import axios from "axios";

// Import spreadsheet reader
import * as XLSX from "xlsx";

import { getZipData } from "../utils/zipData.js";
import { getCached, mapWithConcurrency } from "../utils/dataCache.js";

// import { OpenStreetMapProvider } from 'leaflet-geosearch';
// const provider = new OpenStreetMapProvider();

// Test Command
router.get('/test', (req, res) => {
    const testResponse = { "response": "Success: Viewing Law Enforcement Data" };
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
const currentDate = new Date();
const currentYear = currentDate.getFullYear();

const DATASET_TTL_MS = 24 * 60 * 60 * 1000;
const FBI_STATE_CONCURRENCY = 5;
const MPV_DATASET_URL = "https://mappingpoliceviolence.us/s/MPVDatasetDownload.xlsx";
const MISCONDUCT_SHEET_URL =
    "https://docs.google.com/spreadsheets/d/1tX4F7XP5_5jZEebNQ8ibHR476CsrpLifCWc9nee8uIU/export?format=xlsx";

/**
 * Downloads and parses the Mapping Police Violence workbook once per TTL. All
 * three victim endpoints read from this one result: the workbook is several
 * megabytes, and parsing it per request is what exhausts the container.
 */
function getMpvDataset() {
    return getCached("lawEnforcement:mpv", DATASET_TTL_MS, async () => {
        const response = await axios.get(MPV_DATASET_URL, { responseType: "arraybuffer" });
        const workbook = XLSX.read(response.data, { type: "buffer" });
        const { byPostalCode } = await getZipData();

        const cases = XLSX.utils
            .sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
            .map((incident) => ({
                locationData: incident["Zipcode"] != null ? byPostalCode[incident["Zipcode"]] : undefined,
                "Date of Incident (month/day/year)": incident["Date of Incident (month/day/year)"],
                "Media description of the circumstances surrounding the death":
                    incident["Media description of the circumstances surrounding the death"],
                "Link to news article or photo of official document":
                    incident["Link to news article or photo of official document"],
            }));

        return {
            cases,
            departments: XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[1]]),
            states: XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[2]]),
        };
    });
}

/** Fills the slowest caches so the first visitor of a cold instance isn't the one who pays. */
export async function warmLawEnforcementCache() {
    await getMpvDataset();
}

// Get police population data per state
// takes in year as optional parameter but uses current as default
router.get('/enforcementPopulation', async (req, res) => {
    const year = req.query.year || currentYear;

    try {
        const results = await getCached(
            `lawEnforcement:enforcementPopulation:${year}`,
            DATASET_TTL_MS,
            () =>
                mapWithConcurrency(US_STATE_ABBREVIATIONS, FBI_STATE_CONCURRENCY, async (state) => {
                    const response = await axios.get(`https://api.usa.gov/crime/fbi/cde/pe/${state}?from=${year}&to=${year}&API_KEY=${process.env.FBI_CRIME_KEY}`);
                    let stateMurders = response.data;
                    stateMurders.state = state;
                    return stateMurders;
                })
        );
        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error });
    }
});

// Gets case by case data for people killed by police
// Sourced from https://mappingpoliceviolence.us/
router.get('/policeVictimCases', async (req, res) => {
    try {
        const { cases } = await getMpvDataset();
        res.json(cases);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error });
    }
});

// Gets data for people killed by specific police departments
// Sourced from https://mappingpoliceviolence.us/
router.get('/policeVictimDepts', async (req, res) => {
    try {
        const { departments } = await getMpvDataset();
        res.json(departments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error });
    }
});

// Gets data for people killed by police in each state
// Sourced from https://mappingpoliceviolence.us/
router.get('/policeVictimStates', async (req, res) => {
    try {
        const { states } = await getMpvDataset();
        res.json(states);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error });
    }
});

router.get('/policeGenderViolence', async (req, res) => {
    try {
        const data = await getCached("lawEnforcement:genderViolence", DATASET_TTL_MS, async () => {
            const response = await axios.get(MISCONDUCT_SHEET_URL, {
                responseType: "arraybuffer",
            });

            const workbook = XLSX.read(response.data, { type: "buffer" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];

            const raw = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                defval: null
            });

            const headerRowIndex = raw.findIndex(row => row.includes("Name:"));
            const rows = raw.slice(headerRowIndex + 1);

            return rows
                .filter(row => row[0])
                .map(row => ({
                    name: row[0],
                    title: row[1],
                    state: row[2],
                    formOfViolence: row[3],
                    arrestOrSentence: row[4],
                    link: row[5],
                }));
        });

        res.json({
            source: "Police Sexual Violence Misconduct Database",
            count: data.length,
            cases: data,
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || "Failed to fetch police gender violence data" });
    }
});

export default router;