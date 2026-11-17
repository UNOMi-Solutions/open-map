// NOAA NCEI Global Historical Tsunami Database (Hazel API), runup observations on US coasts.
// Each runup is a place where a tsunami was observed, so distant-source tsunamis (e.g. Kamchatka 2025)
// show up where they reached the US. The API ignores year filters on runups, so every US page is
// fetched and filtered here; the database changes rarely, so it is cached for a day.
import axios from "axios";
import { getCached } from "../utils/dataCache.js";

const RUNUPS_URL = "https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/tsunamis/runups";
const CACHE_MS = 24 * 60 * 60 * 1000;

export const TSUNAMIS_START_YEAR = 1900;

// NCEI validity: -1 erroneous, 0 very doubtful, 1 questionable, 2 probable, 3-4 definite
const MIN_EVENT_VALIDITY = 2;

const CAUSES = {
    1: "Earthquake", 2: "Earthquake", 3: "Earthquake & landslide", 4: "Volcano & earthquake",
    5: "Volcano, earthquake & landslide", 6: "Volcano", 7: "Volcano & landslide", 8: "Landslide",
    9: "Meteorological", 10: "Explosion", 11: "Astronomical tide",
};

async function fetchAllRunups() {
    const first = await axios.get(RUNUPS_URL, { params: { country: "USA", page: 1 }, timeout: 60000 });
    const items = [...(first.data.items ?? [])];
    for (let page = 2; page <= (first.data.totalPages ?? 1); page++) {
        const { data } = await axios.get(RUNUPS_URL, { params: { country: "USA", page }, timeout: 60000 });
        items.push(...(data.items ?? []));
    }
    return items;
}

async function buildTsunamis() {
    const items = await fetchAllRunups();
    const runups = items
        .filter(r =>
            r.year >= TSUNAMIS_START_YEAR &&
            (r.sourceEventValidity ?? 0) >= MIN_EVENT_VALIDITY &&
            Number.isFinite(r.latitude) && Number.isFinite(r.longitude)
        )
        .map(r => ({
            id: r.id,
            eventId: r.tsunamiEventId,
            date: [r.year, r.month, r.day].filter(v => v != null).map((v, i) => i === 0 ? v : String(v).padStart(2, "0")).join("-"),
            year: r.year,
            location: r.locationName,
            state: r.area,
            latitude: r.latitude,
            longitude: r.longitude,
            runupHeightM: r.runupHt ?? null,
            cause: CAUSES[r.sourceCauseCode] ?? null,
            sourceMagnitude: r.sourceEqMagnitude ?? null,
            distanceFromSourceKm: r.distFromSource != null ? Math.round(r.distFromSource) : null,
        }))
        .sort((a, b) => b.date.localeCompare(a.date));

    return {
        source: "NOAA NCEI Global Historical Tsunami Database",
        startYear: TSUNAMIS_START_YEAR,
        totalRunups: runups.length,
        totalEvents: new Set(runups.map(r => r.eventId)).size,
        runups,
    };
}

export function getTsunamis() {
    return getCached("tsunamis:usRunups", CACHE_MS, buildTsunamis);
}
