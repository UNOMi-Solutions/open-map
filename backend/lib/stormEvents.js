// NOAA NCEI Storm Events Database, aggregated to US counties.
// NOAA publishes one gzipped CSV per year (revised as new months are added, ~3 months behind),
// so the files are downloaded and summarized once per day rather than queried per request.
import axios from "axios";
import zlib from "zlib";
import Papa from "papaparse";
import { getCached } from "../utils/dataCache.js";

const STORM_EVENTS_DIR = "https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/";
const ZONE_COUNTY_PAGE = "https://www.weather.gov/gis/ZoneCounty";
const ZONE_COUNTY_DIR = "https://www.weather.gov/source/gis/Shapefiles/County/";
const ZONE_COUNTY_FALLBACK_FILE = "bp16ap26.dbx";
const CACHE_MS = 24 * 60 * 60 * 1000;

export const STORM_EVENTS_START_YEAR = 2024;

// NOAA event types grouped into map categories. Types not listed (marine, fog, rip currents,
// lightning, funnel clouds, ...) are not natural disasters in the sense this layer shows.
const CATEGORY_EVENT_TYPES = {
    "Tornado": ["Tornado"],
    "Thunderstorm Wind": ["Thunderstorm Wind"],
    "Hail": ["Hail"],
    "Flood": ["Flood", "Flash Flood", "Coastal Flood", "Lakeshore Flood"],
    "Hurricane / Tropical Storm": ["Hurricane", "Hurricane (Typhoon)", "Tropical Storm", "Tropical Depression", "Storm Surge/Tide"],
    "Winter Storm": ["Winter Storm", "Winter Weather", "Heavy Snow", "Blizzard", "Ice Storm", "Lake-Effect Snow", "Sleet"],
    "Extreme Cold": ["Extreme Cold/Wind Chill", "Cold/Wind Chill", "Frost/Freeze"],
    "Extreme Heat": ["Heat", "Excessive Heat"],
    "Drought": ["Drought"],
    "High Wind": ["High Wind", "Strong Wind"],
    "Wildfire": ["Wildfire"],
    "Debris Flow": ["Debris Flow"],
};

export const STORM_EVENT_CATEGORIES = Object.keys(CATEGORY_EVENT_TYPES);

const CATEGORY_BY_EVENT_TYPE = new Map(
    Object.entries(CATEGORY_EVENT_TYPES).flatMap(([category, types]) => types.map(t => [t, category]))
);

const MONTH_CODES = { ja: 0, fe: 1, mr: 2, ap: 3, my: 4, jn: 5, jl: 6, au: 7, se: 8, oc: 9, no: 10, de: 11 };

// "10.00K" -> 10000, "1.5M" -> 1500000
function parseDamage(value) {
    if (!value) return 0;
    const match = /^([\d.]+)\s*([KMB])?$/i.exec(String(value).trim());
    if (!match) return 0;
    const multiplier = { K: 1e3, M: 1e6, B: 1e9 }[(match[2] || "").toUpperCase()] ?? 1;
    return Number(match[1]) * multiplier;
}

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function parseCoord(value) {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) && n !== 0 ? n : null;
}

function roundCoord(n) {
    return Math.round(n * 10000) / 10000;
}

function titleCase(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    return text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function eventDate(row) {
    const yearMonth = String(row.BEGIN_YEARMONTH || "");
    if (yearMonth.length !== 6) return null;
    return `${yearMonth.slice(0, 4)}-${yearMonth.slice(4, 6)}-${String(row.BEGIN_DAY).padStart(2, "0")}`;
}

function eventTime(row) {
    const text = String(row.BEGIN_TIME || "").padStart(4, "0");
    return /^\d{4}$/.test(text) ? `${text.slice(0, 2)}:${text.slice(2, 4)}` : null;
}

function parseEfScale(value) {
    const text = String(value || "").trim().toUpperCase();
    if (!text || text.includes("U")) return "EFU";
    const match = text.match(/([0-5])/);
    return match ? `EF${match[1]}` : "EFU";
}

function eventCasualties(row) {
    return {
        deaths: toNumber(row.DEATHS_DIRECT) + toNumber(row.DEATHS_INDIRECT),
        injuries: toNumber(row.INJURIES_DIRECT) + toNumber(row.INJURIES_INDIRECT),
        damage: Math.round(parseDamage(row.DAMAGE_PROPERTY) + parseDamage(row.DAMAGE_CROPS)),
    };
}

// Latest yearly detail file per year, e.g. StormEvents_details-ftp_v1.0_d2025_c20260819.csv.gz
async function listDetailFiles() {
    const { data: html } = await axios.get(STORM_EVENTS_DIR, { timeout: 30000 });
    const latestByYear = new Map();
    for (const match of html.matchAll(/StormEvents_details-ftp_v1\.0_d(\d{4})_c(\d{8})\.csv\.gz/g)) {
        const [file, year, created] = match;
        if (Number(year) < STORM_EVENTS_START_YEAR) continue;
        const current = latestByYear.get(year);
        if (!current || created > current.created) latestByYear.set(year, { file, created });
    }
    return [...latestByYear.values()].map(v => v.file);
}

// NWS publishes the zone-county correlation as bpDDmmYY.dbx; pick the newest one listed
async function latestZoneCountyFile() {
    try {
        const { data: html } = await axios.get(ZONE_COUNTY_PAGE, { timeout: 30000 });
        let best = null;
        for (const [file, day, mon, yy] of html.matchAll(/bp(\d{2})([a-z]{2})(\d{2})\.dbx/g)) {
            if (!(mon in MONTH_CODES)) continue;
            const date = Date.UTC(2000 + Number(yy), MONTH_CODES[mon], Number(day));
            if (!best || date > best.date) best = { file, date };
        }
        if (best) return best.file;
    } catch (error) {
        console.warn("[stormEvents] Could not read zone-county page, using fallback:", error.message);
    }
    return ZONE_COUNTY_FALLBACK_FILE;
}

// Map of stateFips+zone (e.g. "35201") -> county FIPS codes covered by that forecast zone
async function loadZoneCounties() {
    const file = await latestZoneCountyFile();
    const { data: text } = await axios.get(ZONE_COUNTY_DIR + file, { timeout: 60000, responseType: "text" });
    const zoneCounties = new Map();
    for (const line of text.split("\n")) {
        const cols = line.trim().split("|");
        if (cols.length < 7) continue;
        const [, zone, , , , , countyFips] = cols;
        if (!/^\d{5}$/.test(countyFips)) continue;
        const key = countyFips.slice(0, 2) + zone.padStart(3, "0");
        if (!zoneCounties.has(key)) zoneCounties.set(key, new Set());
        zoneCounties.get(key).add(countyFips);
    }
    return zoneCounties;
}

async function buildStormEventsData() {
    const [files, zoneCounties] = await Promise.all([listDetailFiles(), loadZoneCounties()]);

    const counties = {};
    const tornadoes = [];
    const debrisFlows = [];
    // Zone records are expanded onto every county in the zone; one storm often spans several zones
    // over the same county, so zone-derived events count once per county per episode and event type
    const seenZoneEvents = new Set();
    let latestDate = "";
    let unmatchedZoneEvents = 0;

    // Per county: category -> year -> [event count, deaths, injuries, damage $]
    const categoryEntry = (fips, category, year) => {
        if (!counties[fips]) counties[fips] = {};
        if (!counties[fips][category]) counties[fips][category] = {};
        if (!counties[fips][category][year]) counties[fips][category][year] = [0, 0, 0, 0];
        return counties[fips][category][year];
    };

    const addIncidentGeometry = (row) => {
        const beginLat = parseCoord(row.BEGIN_LAT);
        const beginLon = parseCoord(row.BEGIN_LON);
        const endLat = parseCoord(row.END_LAT);
        const endLon = parseCoord(row.END_LON);
        if (beginLat == null || beginLon == null) return;

        const { deaths, injuries, damage } = eventCasualties(row);
        const place = {
            date: eventDate(row),
            time: eventTime(row),
            state: titleCase(row.STATE),
            county: titleCase(row.CZ_NAME),
            deaths,
            injuries,
            damage,
        };

        if (row.EVENT_TYPE === "Tornado") {
            tornadoes.push({
                id: String(row.EVENT_ID),
                ...place,
                ef: parseEfScale(row.TOR_F_SCALE),
                lengthMiles: toNumber(row.TOR_LENGTH) || null,
                widthYards: toNumber(row.TOR_WIDTH) || null,
                beginLat: roundCoord(beginLat),
                beginLon: roundCoord(beginLon),
                endLat: endLat != null ? roundCoord(endLat) : null,
                endLon: endLon != null ? roundCoord(endLon) : null,
            });
            return;
        }

        if (row.EVENT_TYPE === "Debris Flow") {
            debrisFlows.push({
                id: String(row.EVENT_ID),
                ...place,
                latitude: roundCoord(beginLat),
                longitude: roundCoord(beginLon),
            });
        }
    };

    const addRow = (row) => {
        const category = CATEGORY_BY_EVENT_TYPE.get(row.EVENT_TYPE);
        if (!category) return;

        addIncidentGeometry(row);

        const stateFips = String(row.STATE_FIPS || "").padStart(2, "0");
        const czFips = String(row.CZ_FIPS || "").padStart(3, "0");
        let targetCounties;
        if (row.CZ_TYPE === "C") {
            targetCounties = [stateFips + czFips];
        } else if (row.CZ_TYPE === "Z") {
            const mapped = zoneCounties.get(stateFips + czFips);
            if (!mapped) {
                unmatchedZoneEvents++;
                return;
            }
            targetCounties = [...mapped];
        } else {
            return;
        }

        const year = String(row.BEGIN_YEARMONTH || "").slice(0, 4);
        if (!/^\d{4}$/.test(year)) return;

        const date = `${row.BEGIN_YEARMONTH}${String(row.BEGIN_DAY).padStart(2, "0")}`;
        if (date > latestDate) latestDate = date;

        // Casualties and damage are split across the zone's counties so totals are not inflated
        const share = 1 / targetCounties.length;
        const deaths = (toNumber(row.DEATHS_DIRECT) + toNumber(row.DEATHS_INDIRECT)) * share;
        const injuries = (toNumber(row.INJURIES_DIRECT) + toNumber(row.INJURIES_INDIRECT)) * share;
        const damage = (parseDamage(row.DAMAGE_PROPERTY) + parseDamage(row.DAMAGE_CROPS)) * share;

        for (const fips of targetCounties) {
            const entry = categoryEntry(fips, category, year);
            entry[1] += deaths;
            entry[2] += injuries;
            entry[3] += damage;

            if (row.CZ_TYPE === "Z") {
                const key = `${fips}|${row.EPISODE_ID}|${row.EVENT_TYPE}`;
                if (seenZoneEvents.has(key)) continue;
                seenZoneEvents.add(key);
            }
            entry[0]++;
        }
    };

    // Streamed: each decompressed year is ~70MB of text, too much to hold at once on a small container
    for (const file of files) {
        const { data: download } = await axios.get(STORM_EVENTS_DIR + file, { responseType: "stream", timeout: 120000 });
        const csvStream = download.pipe(zlib.createGunzip());
        await new Promise((resolve, reject) => {
            csvStream.on("error", reject);
            Papa.parse(csvStream, {
                header: true,
                skipEmptyLines: true,
                step: ({ data }) => addRow(data),
                complete: resolve,
                error: reject,
            });
        });
    }

    for (const byCategory of Object.values(counties)) {
        for (const byYear of Object.values(byCategory)) {
            for (const entry of Object.values(byYear)) {
                entry[1] = Math.round(entry[1] * 100) / 100;
                entry[2] = Math.round(entry[2] * 100) / 100;
                entry[3] = Math.round(entry[3]);
            }
        }
    }

    const end = latestDate
        ? `${latestDate.slice(0, 4)}-${latestDate.slice(4, 6)}-${latestDate.slice(6, 8)}`
        : null;
    console.log(`[stormEvents] Summarized ${files.length} files into ${Object.keys(counties).length} counties, ${tornadoes.length} tornado segments, ${debrisFlows.length} debris flows (${unmatchedZoneEvents} zone events had no county match)`);

    return {
        source: "NOAA NCEI Storm Events Database",
        dateRange: { start: `${STORM_EVENTS_START_YEAR}-01-01`, end },
        categories: STORM_EVENT_CATEGORIES,
        counties,
        tornadoes,
        debrisFlows,
    };
}

function getStormEventsData() {
    return getCached("stormEvents:byYear", CACHE_MS, buildStormEventsData);
}

export async function getStormEventsSummary() {
    const { tornadoes, debrisFlows, ...summary } = await getStormEventsData();
    return summary;
}

export async function getTornadoes() {
    const data = await getStormEventsData();
    return {
        source: data.source,
        dateRange: data.dateRange,
        totalTornadoes: data.tornadoes.length,
        tornadoes: data.tornadoes,
    };
}

export async function getDebrisFlows() {
    const data = await getStormEventsData();
    return {
        source: data.source,
        dateRange: data.dateRange,
        totalDebrisFlows: data.debrisFlows.length,
        debrisFlows: data.debrisFlows,
    };
}

