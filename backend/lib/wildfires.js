// NIFC Wildland Fire Interagency Geospatial Services (WFIGS) incident locations, from NIFC's hosted
// ArcGIS feature service. Covers every reported wildfire, so only fires of 100+ acres are kept
// (~6k since 2024 vs ~120k total, most of which are spot fires under an acre).
import axios from "axios";
import { getCached } from "../utils/dataCache.js";

const WFIGS_QUERY_URL =
    "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations/FeatureServer/0/query";
const PAGE_SIZE = 2000; // service maxRecordCount
const CACHE_MS = 60 * 60 * 1000;

export const WILDFIRES_START_DATE = "2024-01-01";
export const WILDFIRES_MIN_ACRES = 100;

const OUT_FIELDS = [
    "UniqueFireIdentifier", "IncidentName", "FireDiscoveryDateTime", "FireOutDateTime", "ContainmentDateTime",
    "IncidentSize", "PercentContained", "FireCauseGeneral", "FireCause", "POOState", "POOCounty",
    "TotalIncidentPersonnel",
];

async function fetchAllFires() {
    const features = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data } = await axios.get(WFIGS_QUERY_URL, {
            params: {
                // "WF" excludes prescribed burns ("RX") and non-fire incidents
                where: `IncidentTypeCategory = 'WF' AND FireDiscoveryDateTime >= DATE '${WILDFIRES_START_DATE}' AND IncidentSize >= ${WILDFIRES_MIN_ACRES}`,
                outFields: OUT_FIELDS.join(","),
                orderByFields: "OBJECTID",
                resultOffset: offset,
                resultRecordCount: PAGE_SIZE,
                outSR: 4326,
                f: "geojson",
            },
            timeout: 120000,
        });
        if (data.error) throw new Error(data.error.message || "WFIGS query failed");
        const page = data.features ?? [];
        features.push(...page);
        if (!data.properties?.exceededTransferLimit && page.length < PAGE_SIZE) break;
    }
    return features;
}

async function buildWildfires() {
    const features = await fetchAllFires();
    const fires = features
        .filter(f => Array.isArray(f.geometry?.coordinates))
        .map(f => {
            const p = f.properties;
            return {
                id: p.UniqueFireIdentifier,
                name: p.IncidentName,
                discovered: p.FireDiscoveryDateTime,
                // A fire is treated as over once it is declared out or fully contained
                contained: p.FireOutDateTime ?? p.ContainmentDateTime ?? null,
                acres: Math.round(p.IncidentSize),
                percentContained: p.PercentContained,
                cause: p.FireCauseGeneral || p.FireCause || null,
                state: (p.POOState || "").replace(/^US-/, ""),
                county: p.POOCounty,
                personnel: p.TotalIncidentPersonnel,
                longitude: Math.round(f.geometry.coordinates[0] * 1000) / 1000,
                latitude: Math.round(f.geometry.coordinates[1] * 1000) / 1000,
            };
        });

    return {
        source: "NIFC Wildland Fire Interagency Geospatial Services (WFIGS)",
        dateRange: { start: WILDFIRES_START_DATE, end: new Date().toISOString().split("T")[0] },
        minAcres: WILDFIRES_MIN_ACRES,
        totalFires: fires.length,
        fires,
    };
}

export function getWildfires() {
    return getCached("wildfires:incidents", CACHE_MS, buildWildfires);
}
