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

// Import file stream and csv reader
import fs from "fs";
import csvParser from "csv-parser";
const zips = {}

fs.createReadStream("./data/USZipsWithLatLon_20231227.csv")
  .pipe(csvParser())
  .on("data", (data) => {
    //zips.push(data);
    zips[data["postal code"]] = data;
  })


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

// Get police population data per state
// takes in year as optional parameter but uses current as default
router.get('/enforcementPopulation', async (req, res) => {
    const year = req.query.year || currentYear;

    try {
        const results = await Promise.all(
            US_STATE_ABBREVIATIONS.map(async (state) => {
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
        const response = await axios.get("https://mappingpoliceviolence.us/s/MPVDatasetDownload.xlsx", {
            responseType: "arraybuffer",
        });

        const workbook = XLSX.read(response.data, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const wantedColumns = [
            'locationData',
            'Date of Incident (month/day/year)',
            'Media description of the circumstances surrounding the death',
            'Link to news article or photo of official document'
        ];

        const jsonData = XLSX.utils.sheet_to_json(sheet);

        jsonData.map(async (incident) => {
            if(incident["Zipcode"] != null) {
                incident["locationData"] = zips[incident["Zipcode"]]
            }
        });

        const filteredData = jsonData.map(incident => {
            Object.keys(incident).forEach(key => {
                if (!wantedColumns.includes(key)) {
                    delete incident[key];
                }
            });
            return incident;
        });

        res.json(filteredData);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error });
    }
});

// Gets data for people killed by specific police departments
// Sourced from https://mappingpoliceviolence.us/
router.get('/policeVictimDepts', async (req, res) => {
    try {
        const response = await axios.get("https://mappingpoliceviolence.us/s/MPVDatasetDownload.xlsx", {
            responseType: "arraybuffer",
        });

        const workbook = XLSX.read(response.data, { type: "buffer" });
        const sheetName = workbook.SheetNames[1];
        const sheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json(sheet);

        res.json(jsonData);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error });
    }
});

// Gets data for people killed by police in each state
// Sourced from https://mappingpoliceviolence.us/
router.get('/policeVictimStates', async (req, res) => {
    try {
        const response = await axios.get("https://mappingpoliceviolence.us/s/MPVDatasetDownload.xlsx", {
            responseType: "arraybuffer",
        });

        const workbook = XLSX.read(response.data, { type: "buffer" });
        const sheetName = workbook.SheetNames[2];
        const sheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json(sheet);

        res.json(jsonData);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error });
    }
});

router.get('/policeGenderViolence', async (req, res) => {
    try {
        const url = "https://docs.google.com/spreadsheets/d/1tX4F7XP5_5jZEebNQ8ibHR476CsrpLifCWc9nee8uIU/export?format=xlsx";

        const response = await axios.get(url, {
        responseType: "arraybuffer",
        });

        const workbook = XLSX.read(response.data, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        const raw = XLSX.utils.sheet_to_json(sheet, {
        header: 1,     
        defval: null
        });

        const headerRowIndex = raw.findIndex(row => row.includes("Name:"));

        const headers = raw[headerRowIndex];
        const rows = raw.slice(headerRowIndex + 1);

        const data = rows
        .filter(row => row[0])
        .map(row => ({
            name: row[0],
            title: row[1],
            state: row[2],
            formOfViolence: row[3],
            arrestOrSentence: row[4],
            link: row[5],
        }));

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