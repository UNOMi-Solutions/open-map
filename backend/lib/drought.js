// U.S. Drought Monitor (USDM) county statistics. The map is released every Thursday for the
// preceding Tuesday; the county endpoint only answers per state, so states are queried in parallel.
import axios from "axios";
import { getCached, mapWithConcurrency } from "../utils/dataCache.js";

const COUNTY_STATS_URL =
    "https://usdmdataservices.unl.edu/api/CountyStatistics/GetDroughtSeverityStatisticsByAreaPercent";
const CACHE_MS = 6 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 14;

const STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
    "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC",
    "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "PR",
];

const usdmDate = (d) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;

async function fetchStateCounties(state, start, end) {
    const { data } = await axios.get(COUNTY_STATS_URL, {
        params: { aoi: state, startdate: usdmDate(start), enddate: usdmDate(end), statisticsType: 1 },
        headers: { Accept: "application/json" },
        timeout: 60000,
    });
    return Array.isArray(data) ? data : [];
}

async function buildDroughtSummary() {
    const end = new Date();
    const start = new Date(end.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const perState = await mapWithConcurrency(STATES, 8, (state) =>
        fetchStateCounties(state, start, end).catch((error) => {
            console.warn(`[drought] Skipping ${state}:`, error.message);
            return [];
        })
    );

    // The lookback covers two weekly maps; keep the newest one for every county
    const latestByFips = new Map();
    for (const row of perState.flat()) {
        const current = latestByFips.get(row.fips);
        if (!current || row.mapDate > current.mapDate) latestByFips.set(row.fips, row);
    }

    let mapDate = null;
    const counties = {};
    for (const [fips, row] of latestByFips) {
        if (!mapDate || row.mapDate > mapDate) mapDate = row.mapDate;
        // Percent of county area in each category or worse (D1 includes D2-D4), so values never increase
        counties[fips] = [row.d0, row.d1, row.d2, row.d3, row.d4].map(v => Math.round(Number(v) * 10) / 10);
    }

    return {
        source: "U.S. Drought Monitor",
        mapDate: mapDate ? mapDate.split("T")[0] : null,
        categories: ["D0 Abnormally Dry", "D1 Moderate", "D2 Severe", "D3 Extreme", "D4 Exceptional"],
        counties,
    };
}

export function getDroughtSummary() {
    return getCached("drought:counties", CACHE_MS, buildDroughtSummary);
}
