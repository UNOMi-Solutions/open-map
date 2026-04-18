// Import OpenAI Library for data collection
import OpenAI from "openai";

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

// Lazy OpenAI client — only initialized on first use so missing key won't crash startup
let _openaiClient = null;
function getOpenAIClient() {
  if (!_openaiClient) {
    _openaiClient = new OpenAI();
  }
  return _openaiClient;
}

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

// Get general murder data for all states
// Takes in year as optional parameter, will output current year by default
router.get('/murderByState', async (req, res) => {
    const year = req.query.year || currentYear;
    let murderJSON = {}

    try {
        const results = await Promise.all(
            US_STATE_ABBREVIATIONS.map(async (state) => {
                const response = await axios.get(`https://api.usa.gov/crime/fbi/cde/shr/state/${state}?type=totals&from=01-${year}&to=12-${year}&API_KEY=${process.env.FBI_CRIME_KEY}`);
                let stateMurders = response.data;
                murderJSON[state] = stateMurders;
            })
        );
        res.json(murderJSON);
    } catch (error) {
        console.error(error);
        res.status(500).json( { error: error });
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
    const year = req.query.year || currentYear;
    let offenseCode = req.query.offenseCode || "all";
    if (offenseCodes[offenseCode] == undefined) {
        offenseCode = "all";
    }

    let arrestsJSON = {}

    try {
        const results = await Promise.all(
            US_STATE_ABBREVIATIONS.map(async (state) => {
                const response = await axios.get(`https://api.usa.gov/crime/fbi/cde/arrest/state/${state}/${offenseCode}?type=totals&from=01-${year}&to=12-${year}&API_KEY=${process.env.FBI_CRIME_KEY}`);
                let stateArrests = response.data;
                // stateArrests.state = state;
                // return stateArrests;
                arrestsJSON[state] = stateArrests;
            })
        );
        res.json(arrestsJSON);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error });
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