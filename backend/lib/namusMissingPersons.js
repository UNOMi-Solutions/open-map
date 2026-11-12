// Open missing persons cases from NamUs, the National Missing and Unidentified Persons
// System run by the National Institute of Justice: https://www.namus.gov/MissingPersons/Search
import axios from "axios";
import fs from "fs";
import zlib from "zlib";
import path from "path";
import { fileURLToPath } from "url";
import { mapWithConcurrency } from "../utils/dataCache.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const NAMUS_SNAPSHOT_PATH = path.join(__dirname, "..", "data", "namusMissingPersons.json.gz");

const NAMUS_ORIGIN = "https://www.namus.gov";
const NAMUS_API_URL = `${NAMUS_ORIGIN}/api/CaseSets/NamUs`;
const REQUEST_TIMEOUT_MS = 60000;
// NamUs rejects any search whose skip + take exceeds this, so the pull is split by state.
const MAX_RESULTS_PER_SEARCH = 10000;
const STATE_CONCURRENCY = 4;

const PROJECTIONS = [
    "namus2Number",
    "idFormatted",
    "firstName",
    "middleName",
    "lastName",
    "nicknames",
    "computedMissingMinAge",
    "computedMissingMaxAge",
    "gender",
    "raceEthnicity",
    "cityOfLastContact",
    "countyDisplayNameOfLastContact",
    "stateDisplayNameOfLastContact",
    "dateOfLastContact",
    "modifiedDateTime",
    "circumstancesOfDisappearance",
    "publicGeolocation",
];

async function search(predicates) {
    const { data } = await axios.post(
        `${NAMUS_API_URL}/MissingPersons/Search`,
        {
            take: MAX_RESULTS_PER_SEARCH,
            skip: 0,
            projections: PROJECTIONS,
            predicates,
            orderSpecifications: [{ field: "namus2Number", direction: "Ascending" }],
        },
        { timeout: REQUEST_TIMEOUT_MS },
    );
    if (!Array.isArray(data?.results)) throw new Error("NamUs search returned no results array");
    return data;
}

/** Downloads every published open case, or throws if any part of the pull is incomplete. */
export async function downloadNamusMissingPersons() {
    const { data: states } = await axios.get(`${NAMUS_API_URL}/States`, { timeout: REQUEST_TIMEOUT_MS });
    if (!Array.isArray(states) || !states.length) throw new Error("NamUs returned no states");

    const { count: total } = await search([]);

    const perState = await mapWithConcurrency(states, STATE_CONCURRENCY, async (state) => {
        const { count, results } = await search([
            { field: "stateOfLastContact", operator: "IsIn", values: [state.name] },
        ]);
        if (count > results.length) {
            throw new Error(`NamUs has ${count} cases in ${state.name}, more than one search can return`);
        }
        return results;
    });

    const byId = new Map(perState.flat().map((row) => [row.namus2Number, row]));
    if (byId.size < total) {
        console.warn(`[namus] ${total - byId.size} of ${total} cases have no state of last contact and were skipped`);
    }
    return [...byId.values()];
}

export async function readNamusSnapshot() {
    if (!fs.existsSync(NAMUS_SNAPSHOT_PATH)) {
        throw new Error(`No bundled NamUs snapshot at ${NAMUS_SNAPSHOT_PATH}; run npm run seed:missing-persons`);
    }
    const json = zlib.gunzipSync(await fs.promises.readFile(NAMUS_SNAPSHOT_PATH));
    return JSON.parse(json);
}

function toText(value) {
    const text = String(value ?? "").trim();
    return text || null;
}

function formatAge(min, max) {
    if (min == null && max == null) return null;
    if (min == null || max == null || min === max) return `${min ?? max}`;
    return `${min}–${max}`;
}

/** Falls back to the city's zip centroid, then the county's, when NamUs has no public pin. */
function locateFallback(city, county, stateCode, { byPlace, byCounty }) {
    const cityRow = city && stateCode ? byPlace[`${city}|${stateCode}`.toLowerCase()] : null;
    const countyRow = county ? byCounty[county] : null;
    const row = cityRow ?? (countyRow?.["admin code1"] === stateCode ? countyRow : null);
    return row ? { latitude: Number(row.latitude), longitude: Number(row.longitude) } : null;
}

export function normalizeNamusMissingPerson(row, zipData) {
    const id = row.namus2Number ?? null;
    const city = toText(row.cityOfLastContact);
    const county = toText(row.countyDisplayNameOfLastContact);
    const state = toText(row.stateDisplayNameOfLastContact);

    let latitude = row.publicGeolocation?.lat ?? null;
    let longitude = row.publicGeolocation?.lon ?? null;
    const approximate = latitude == null || longitude == null;
    if (approximate) {
        const fallback = locateFallback(city, county, state, zipData);
        latitude = fallback?.latitude ?? null;
        longitude = fallback?.longitude ?? null;
    }

    const date = /^\d{4}-\d{2}-\d{2}/.test(row.dateOfLastContact ?? "") ? row.dateOfLastContact.slice(0, 10) : null;

    return {
        id,
        caseNumber: toText(row.idFormatted) ?? (id ? `MP${id}` : null),
        firstName: toText(row.firstName),
        middleName: toText(row.middleName),
        lastName: toText(row.lastName),
        nicknames: toText(row.nicknames),
        missingAge: formatAge(row.computedMissingMinAge ?? null, row.computedMissingMaxAge ?? null),
        sex: toText(row.gender),
        raceEthnicity: toText(row.raceEthnicity),
        city,
        county,
        state,
        dateOfLastContact: date,
        modified: toText(row.modifiedDateTime)?.slice(0, 10) ?? null,
        circumstances: toText(row.circumstancesOfDisappearance),
        latitude,
        longitude,
        coordinatesApproximate: approximate && latitude != null,
    };
}
