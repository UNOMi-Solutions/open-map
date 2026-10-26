// FEMA National Risk Index (NRI), county level, from FEMA's hosted ArcGIS feature service.
// NRI is refreshed roughly once a year, so the summary is cached for a week.
import axios from "axios";
import { getCached } from "../utils/dataCache.js";

const NRI_COUNTIES_QUERY_URL =
    "https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0/query";
const PAGE_SIZE = 2000; // service maxRecordCount
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;

export const NRI_HAZARDS = {
    AVLN: "Avalanche",
    CFLD: "Coastal Flooding",
    CWAV: "Cold Wave",
    DRGT: "Drought",
    ERQK: "Earthquake",
    HAIL: "Hail",
    HWAV: "Heat Wave",
    HRCN: "Hurricane",
    ISTM: "Ice Storm",
    IFLD: "Inland Flooding",
    LNDS: "Landslide",
    LTNG: "Lightning",
    SWND: "Strong Wind",
    TRND: "Tornado",
    TSUN: "Tsunami",
    VLCN: "Volcanic Activity",
    WFIR: "Wildfire",
    WNTW: "Winter Weather",
};

// Ratings are sent as indexes into this list to keep the ~3,200-county payload small
export const NRI_RATINGS = [
    "Very Low",
    "Relatively Low",
    "Relatively Moderate",
    "Relatively High",
    "Very High",
    "No Rating",
    "Not Applicable",
    "Insufficient Data",
];
const NOT_APPLICABLE = NRI_RATINGS.indexOf("Not Applicable");

const BASE_FIELDS = ["STCOFIPS", "COUNTY", "STATEABBRV", "RISK_SCORE", "RISK_RATNG", "EAL_VALT", "SOVI_RATNG", "RESL_RATNG", "NRI_VER"];
const HAZARD_FIELDS = Object.keys(NRI_HAZARDS).flatMap(code =>
    ["RISKS", "RISKR", "EALT", "AFREQ"].map(suffix => `${code}_${suffix}`)
);

function ratingIndex(value) {
    const index = NRI_RATINGS.indexOf(value);
    return index === -1 ? NRI_RATINGS.indexOf("Insufficient Data") : index;
}

const round = (value, digits) => {
    if (value == null || !Number.isFinite(value)) return null;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

async function fetchAllCounties() {
    const rows = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data } = await axios.get(NRI_COUNTIES_QUERY_URL, {
            params: {
                where: "1=1",
                outFields: [...BASE_FIELDS, ...HAZARD_FIELDS].join(","),
                returnGeometry: false,
                orderByFields: "OBJECTID",
                resultOffset: offset,
                resultRecordCount: PAGE_SIZE,
                f: "json",
            },
            timeout: 120000,
        });
        if (data.error) throw new Error(data.error.message || "NRI query failed");
        const features = data.features ?? [];
        rows.push(...features.map(f => f.attributes));
        if (!data.exceededTransferLimit && features.length < PAGE_SIZE) break;
    }
    return rows;
}

async function buildNationalRiskIndexSummary() {
    const rows = await fetchAllCounties();
    const counties = {};
    let version = null;

    for (const row of rows) {
        if (!row.STCOFIPS) continue;
        version = version ?? row.NRI_VER;

        // Per hazard: [risk score 0-100, rating index, expected annual loss $, annualized frequency].
        // Hazards that cannot occur in a county ("Not Applicable") are omitted.
        const hazards = {};
        for (const code of Object.keys(NRI_HAZARDS)) {
            const rating = ratingIndex(row[`${code}_RISKR`]);
            if (rating === NOT_APPLICABLE) continue;
            hazards[code] = [
                round(row[`${code}_RISKS`], 1),
                rating,
                round(row[`${code}_EALT`], 0),
                round(row[`${code}_AFREQ`], 5),
            ];
        }

        counties[row.STCOFIPS] = {
            name: row.COUNTY,
            state: row.STATEABBRV,
            riskScore: round(row.RISK_SCORE, 1),
            riskRating: ratingIndex(row.RISK_RATNG),
            expectedAnnualLoss: round(row.EAL_VALT, 0),
            socialVulnerability: ratingIndex(row.SOVI_RATNG),
            communityResilience: ratingIndex(row.RESL_RATNG),
            hazards,
        };
    }

    return {
        source: "FEMA National Risk Index",
        version,
        hazards: NRI_HAZARDS,
        ratings: NRI_RATINGS,
        counties,
    };
}

export function getNationalRiskIndexSummary() {
    return getCached("nri:counties", CACHE_MS, buildNationalRiskIndexSummary);
}
