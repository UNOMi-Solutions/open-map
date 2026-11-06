// Gun Violence Archive mass shootings (4+ victims shot, 2014–present), published
// by The Trace's Gun Violence Data Hub: https://datahub.thetrace.org/dataset/mass-shootings/
import axios from "axios";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { Readable } from "stream";
import { fileURLToPath } from "url";
import csvParser from "csv-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const GVA_SNAPSHOT_PATH = path.join(__dirname, "..", "data", "gvaMassShootings.csv.gz");

const DATAHUB_DATASET_URL = "https://datahub.thetrace.org/wp-json/dataset/v1/dataset/1067";
const REDIVIS_STREAM_URL = "https://redivis.com/api/v1/readStreams";
const GVA_TABLE_LABEL = "gva_mass_shootings";
const REQUEST_TIMEOUT_MS = 60000;

/** The Data Hub only serves the full table to a named requester, same as its download form. */
export function getDataHubRequester() {
    const firstName = process.env.DATAHUB_FIRST_NAME?.trim();
    const lastName = process.env.DATAHUB_LAST_NAME?.trim();
    const email = process.env.DATAHUB_EMAIL?.trim();
    return firstName && lastName && email ? { firstName, lastName, email } : null;
}

/** Downloads the current table as CSV text, or throws if the Data Hub refuses. */
export async function downloadGvaMassShootingsCsv() {
    const requester = getDataHubRequester();
    if (!requester) {
        throw new Error("DATAHUB_FIRST_NAME, DATAHUB_LAST_NAME and DATAHUB_EMAIL must be set");
    }

    // The table id carries a version suffix that changes as the dataset is republished.
    const { data: dataset } = await axios.get(DATAHUB_DATASET_URL, { timeout: REQUEST_TIMEOUT_MS });
    const table = dataset.items?.find((item) => item.label === GVA_TABLE_LABEL);
    if (!table) throw new Error(`Data Hub dataset has no "${GVA_TABLE_LABEL}" table`);

    const { data: stream } = await axios.post(
        // The route only matches the raw id; percent-encoded colons 404.
        `${DATAHUB_DATASET_URL}/table/${table.value}/filter`,
        { filters: {}, format: "csv", ...requester, mailingList: false, notify: false },
        { timeout: REQUEST_TIMEOUT_MS },
    );
    if (!stream?.stream_id) throw new Error("Data Hub did not return a download stream");

    const { data: csv } = await axios.get(`${REDIVIS_STREAM_URL}/${stream.stream_id}`, {
        responseType: "text",
        timeout: REQUEST_TIMEOUT_MS,
    });
    return csv;
}

function parseCsv(stream) {
    return new Promise((resolve, reject) => {
        const rows = [];
        stream
            .on("error", reject)
            .pipe(csvParser({ mapHeaders: ({ header }) => header.trim() }))
            .on("data", (row) => rows.push(row))
            .on("end", () => resolve(rows))
            .on("error", reject);
    });
}

export function parseGvaCsv(csv) {
    return parseCsv(Readable.from([csv]));
}

export async function readGvaSnapshot() {
    if (!fs.existsSync(GVA_SNAPSHOT_PATH)) {
        throw new Error(`No bundled GVA snapshot at ${GVA_SNAPSHOT_PATH}; run npm run seed:mass-shootings`);
    }
    // pipe() doesn't forward errors, so an unreadable file would otherwise crash the process.
    const gunzip = zlib.createGunzip();
    fs.createReadStream(GVA_SNAPSHOT_PATH).on("error", (error) => gunzip.destroy(error)).pipe(gunzip);
    return parseCsv(gunzip);
}

function toNumber(value) {
    const text = String(value ?? "").replace(/,/g, "").trim();
    const n = text ? Number(text) : NaN;
    return Number.isFinite(n) ? n : null;
}

function toText(value) {
    const text = String(value ?? "").trim();
    return text && text !== "N/A" ? text : null;
}

/** GVA list columns are exported as R vectors: c("a", "b"). Single values have no wrapper. */
function parseList(value) {
    const text = toText(value);
    if (!text) return [];
    if (!text.startsWith("c(")) return [text];
    return [...text.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"').trim()).filter(Boolean);
}

// Every row carries these, so they add nothing to an individual incident.
const GENERIC_CHARACTERISTICS = /^(Shot - |Mass Shooting \()/;

/** GVA coordinates are occasionally missing; fall back to the city's zip centroid. */
function locateCity(city, stateCode, byPlace) {
    if (!city || !stateCode) return null;
    const row = byPlace[`${city}|${stateCode}`.toLowerCase()];
    return row ? { latitude: Number(row.latitude), longitude: Number(row.longitude) } : null;
}

export function normalizeGvaMassShooting(row, { byPlace, stateCodes }) {
    const id = toNumber(row.incident_id);
    const city = toText(row.city_or_county);
    const state = toText(row.state);
    const stateCode = state ? stateCodes[state.toLowerCase()] ?? (state === "District of Columbia" ? "DC" : null) : null;

    let latitude = toNumber(row.latitude);
    let longitude = toNumber(row.longitude);
    const approximate = !latitude || !longitude;
    if (approximate) {
        const cityMatch = locateCity(city, stateCode, byPlace);
        latitude = cityMatch?.latitude ?? null;
        longitude = cityMatch?.longitude ?? null;
    }

    const fatalities = toNumber(row.victims_killed);
    const injured = toNumber(row.victims_injured);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(row.date_fixed ?? "") ? row.date_fixed : null;

    return {
        id,
        location: [city, state].filter(Boolean).join(", ") || null,
        address: toText(row.address),
        venue: toText(row.business_location_name),
        state: stateCode,
        date,
        time: toText(row.incident_time),
        year: toNumber(row.year) ?? (date ? Number(date.slice(0, 4)) : null),
        fatalities,
        injured,
        totalVictims: fatalities == null && injured == null ? null : (fatalities ?? 0) + (injured ?? 0),
        suspectsKilled: toNumber(row.suspects_killed),
        suspectsInjured: toNumber(row.suspects_injured),
        suspectsArrested: toNumber(row.suspects_arrested),
        characteristics: parseList(row.incident_characteristics).filter((c) => !GENERIC_CHARACTERISTICS.test(c)),
        sources: parseList(row.sources),
        gvaUrl: id ? `https://www.gunviolencearchive.org/incident/${id}` : null,
        latitude,
        longitude,
        coordinatesApproximate: approximate && latitude != null,
    };
}
