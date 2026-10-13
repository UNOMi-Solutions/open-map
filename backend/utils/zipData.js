import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csvParser from "csv-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZIP_CSV_PATH = path.join(__dirname, "..", "data", "USZipsWithLatLon_20231227.csv");

let loadPromise = null;

/**
 * Parses the 2.5MB zip-code CSV once for the whole process. Route modules used
 * to each stream their own copy at import time and then read the half-filled
 * result, so early requests silently lost their location data.
 */
export function getZipData() {
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const byPostalCode = {};
      const byCounty = {};

      fs.createReadStream(ZIP_CSV_PATH)
        .pipe(csvParser())
        .on("data", (row) => {
          byPostalCode[row["postal code"]] = row;
          byCounty[row["admin name2"]] = row;
        })
        .on("end", () => resolve({ byPostalCode, byCounty }))
        .on("error", reject);
    }).catch((error) => {
      loadPromise = null;
      throw error;
    });
  }

  return loadPromise;
}
