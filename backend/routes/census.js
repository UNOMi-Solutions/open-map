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
    const testResponse = { "response": "Success: Viewing Census Data" };
    res.json(testResponse);
})

export default router;
