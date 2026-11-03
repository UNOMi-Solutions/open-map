// USGS Landslide Inventories across the United States (ver. 3.0, February 2025).
// PASDA hosts the point and polygon layers; NASA's Global Landslide Catalog is included as
// the "NASA" inventory. The full inventory is ~1M mapped features, mostly undated deposits,
// so this layer keeps dated incidents: NASA events, fatal slides, and anything since 2020.
import axios from "axios";
import JSZip from "jszip";
import Papa from "papaparse";
import { getCached } from "../utils/dataCache.js";

const SERVICE_CANDIDATES = [
    "https://mapservices.pasda.psu.edu/server/rest/services/pasda/USGeologicalSurvey2/MapServer",
    "https://services.pasda.psu.edu/server/rest/services/pasda/USGeologicalSurvey2/MapServer",
];
const POINT_LAYER = 5;
const POLY_LAYER = 6;
const PAGE_SIZE = 1000;
const CACHE_MS = 24 * 60 * 60 * 1000;

const SCIENCEBASE_CSV_ZIP =
    "https://www.sciencebase.gov/catalog/file/get/671eef1fd34ed0f827ea9f12?f=__disk__24%2F9f%2Fae%2F249fae3baf51aaf4c1bc9e02a6d69ac6ff276ffd";

export const LANDSLIDES_START_YEAR = 2000;

const OUT_FIELDS = [
    "USGS_ID", "Date_Min", "Date_Max", "Fatalities", "Confidence",
    "LS_Type", "Inventory", "Inv_URL", "Lat_N", "Lon_W",
];

// ArcGIS string dates look like "2020/09/22 00:00:00.000"; slash sorts after dash, so
// Date_Min >= '2020-01-01' still selects 2020+ rows.
const INCIDENT_WHERE =
    "Lat_N IS NOT NULL AND Lon_W IS NOT NULL AND (Inventory = 'NASA' OR Fatalities > 0 OR Date_Min >= '2020-01-01')";

export const LANDSLIDE_KINDS = ["Landslide", "Debris flow", "Mudslide", "Rockfall", "Other"];

function blank(value) {
    if (value == null) return true;
    const text = String(value).trim();
    return !text || text === "None" || text === "null";
}

function parseDate(value) {
    if (blank(value)) return null;
    const text = String(value).trim();
    const ymd = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (ymd) {
        return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
    }
    const year = text.match(/^(\d{4})/);
    return year ? `${year[1]}-01-01` : null;
}

function landslideKind(lsType) {
    const t = String(lsType || "").trim().toLowerCase().replace(/[_-]+/g, " ");
    if (/gully|avalanche chute|flume experiment|pavement|road closure/.test(t)) return null;
    if (/debris flow|debris torrent|lahar/.test(t)) return "Debris flow";
    if (/mudslide|mud slide|earth flow|earthflow/.test(t)) return "Mudslide";
    if (/rock\s?fall|rockfall/.test(t)) return "Rockfall";
    if (/snow avalanche|ice avalanche|ice fall/.test(t)) return null;
    if (!t || /landslide|slide|slump|flow|complex|fall|failure|creep|spread/.test(t)) return "Landslide";
    return "Other";
}

function isIncidentRow(row) {
    const inventory = String(row.Inventory || "").trim();
    const fatalities = Number(row.Fatalities);
    const date = parseDate(row.Date_Min) || parseDate(row.Date_Max);
    if (inventory === "NASA") return Boolean(date);
    if (Number.isFinite(fatalities) && fatalities > 0) return true;
    return date != null && Number(date.slice(0, 4)) >= 2020;
}

function toRecord(row) {
    const latitude = Number(row.Lat_N);
    const longitude = Number(row.Lon_W);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const date = parseDate(row.Date_Min) || parseDate(row.Date_Max);
    const kind = landslideKind(row.LS_Type);
    if (!kind) return null;
    const fatalities = Number(row.Fatalities);
    const confidence = Number(row.Confidence);
    const rawType = blank(row.LS_Type) ? null : String(row.LS_Type).trim();
    return {
        id: String(row.USGS_ID || "").trim() || null,
        date,
        year: date ? Number(date.slice(0, 4)) : null,
        kind,
        type: rawType,
        fatalities: Number.isFinite(fatalities) && fatalities > 0 ? fatalities : 0,
        confidence: Number.isFinite(confidence) ? confidence : null,
        inventory: blank(row.Inventory) ? null : String(row.Inventory).trim(),
        latitude: Math.round(latitude * 10000) / 10000,
        longitude: Math.round(longitude * 10000) / 10000,
        url: blank(row.Inv_URL) ? null : String(row.Inv_URL).trim(),
    };
}

async function fetchLayerPages(baseUrl, layerId) {
    const features = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data } = await axios.get(`${baseUrl}/${layerId}/query`, {
            params: {
                where: INCIDENT_WHERE,
                outFields: OUT_FIELDS.join(","),
                orderByFields: "OBJECTID",
                resultOffset: offset,
                resultRecordCount: PAGE_SIZE,
                returnGeometry: false,
                f: "json",
            },
            timeout: 120000,
        });
        if (data.error) throw new Error(data.error.message || "USGS landslide query failed");
        const page = data.features ?? [];
        features.push(...page.map((f) => f.attributes ?? f.properties ?? {}));
        if (!data.exceededTransferLimit && page.length < PAGE_SIZE) break;
    }
    return features;
}

async function fetchFromPasda() {
    let lastError;
    for (const baseUrl of SERVICE_CANDIDATES) {
        try {
            const [points, polygons] = await Promise.all([
                fetchLayerPages(baseUrl, POINT_LAYER),
                fetchLayerPages(baseUrl, POLY_LAYER),
            ]);
            return [...points, ...polygons];
        } catch (error) {
            lastError = error;
            console.warn(`[landslides] ${baseUrl} failed:`, error.message);
        }
    }
    throw lastError;
}

async function fetchFromScienceBase() {
    const response = await axios.get(SCIENCEBASE_CSV_ZIP, {
        responseType: "arraybuffer",
        timeout: 180000,
    });
    const zip = await JSZip.loadAsync(response.data);
    const rows = [];
    for (const name of Object.keys(zip.files)) {
        if (!name.toLowerCase().endsWith(".csv") || zip.files[name].dir) continue;
        const csvText = await zip.files[name].async("string");
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        for (const row of parsed.data) {
            if (isIncidentRow(row)) rows.push(row);
        }
    }
    if (!rows.length) throw new Error("ScienceBase landslide CSV had no incident rows");
    return rows;
}

function buildBody(rows) {
    const seen = new Set();
    const landslides = [];
    for (const row of rows) {
        const record = toRecord(row);
        if (!record?.id || seen.has(record.id)) continue;
        if (record.year != null && (record.year < LANDSLIDES_START_YEAR || record.year > new Date().getFullYear())) continue;
        seen.add(record.id);
        landslides.push(record);
    }
    landslides.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    return {
        source: "USGS Landslide Hazards Program",
        citation: "Landslide Inventories across the United States (ver. 3.0, February 2025)",
        startYear: LANDSLIDES_START_YEAR,
        totalLandslides: landslides.length,
        landslides,
    };
}

async function buildLandslides() {
    try {
        return buildBody(await fetchFromPasda());
    } catch (error) {
        console.warn("[landslides] PASDA unavailable, falling back to ScienceBase CSV:", error.message);
        return buildBody(await fetchFromScienceBase());
    }
}

export function getLandslides() {
    return getCached("landslides:usIncidents", CACHE_MS, buildLandslides);
}
