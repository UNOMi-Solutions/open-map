import axios from "axios";
import { getCached } from "../utils/dataCache.js";

export const SEWAGE_SOURCE_URL = "https://echo.epa.gov/tools/data-downloads/cso-inventory-summary";
export const SEWAGE_QUERY_URL = "https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/Combined_Sewer_Overflows/FeatureServer/0/query";
const FIELDS = "OBJECTID,npdes_pfid,npdes_id,facility_uin,facility_name,facility_city,state_code,perm_feature_nmbr,perm_feature_text,pf_lat,pf_lon,pf_character,pf_state_waterbody_name,pf_state_auto_name,permit_status_code";

function coordinate(value, min, max) {
  if (!["number", "string"].includes(typeof value) || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

// Only map the outfall coordinates; the facility address can be miles from the pipe.
export function normalizeSewageOutfall(attributes) {
  if (!attributes || typeof attributes !== "object") return null;
  const latitude = coordinate(attributes.pf_lat, -90, 90);
  const longitude = coordinate(attributes.pf_lon, -180, 180);
  const codes = String(attributes.pf_character || "").toUpperCase().split(/[^A-Z]+/);
  const permitId = String(attributes.npdes_id || "").trim();
  const id = String(attributes.npdes_pfid || "").trim();
  if (!id || !permitId || latitude === null || longitude === null || (latitude === 0 && longitude === 0) ||
      codes.includes("CLS") || !codes.some((code) => code === "CSO" || code === "TCS")) return null;
  const facilityId = String(attributes.facility_uin || "");
  return {
    id, permitId, outfallNumber: String(attributes.perm_feature_nmbr || ""),
    name: String(attributes.perm_feature_text || `Outfall ${attributes.perm_feature_nmbr || id}`),
    facilityName: String(attributes.facility_name || "Not specified"),
    city: String(attributes.facility_city || ""), state: String(attributes.state_code || ""),
    waterbody: String(attributes.pf_state_waterbody_name || attributes.pf_state_auto_name || "Not specified"),
    treatment: codes.includes("TCS") ? (codes.includes("CSO") ? "Multiple classifications" : "Treated CSO") : "Untreated CSO",
    permitStatus: String(attributes.permit_status_code || "Not specified"),
    latitude, longitude,
    sourceUrl: /^\d{10,15}$/.test(facilityId) ? `https://echo.epa.gov/detailed-facility-report?fid=${facilityId}` : SEWAGE_SOURCE_URL,
  };
}

async function fetchEpaJson(params) {
  const { data } = await axios.get(SEWAGE_QUERY_URL, { params, timeout: 30000 });
  return data;
}

// Fetch all pages in stable order and cache only a complete, successful inventory.
export async function fetchSewageOutfalls(fetchJson = fetchEpaJson) {
  const outfalls = new Map();
  const excludedIds = new Set();
  let offset = 0;
  for (let page = 0; page < 100; page += 1) {
    const data = await fetchJson({
      where: "1=1", outFields: FIELDS, returnGeometry: false,
      orderByFields: "OBJECTID ASC", resultOffset: offset, resultRecordCount: 1000, f: "json",
    });
    if (data?.error || !Array.isArray(data?.features)) throw new Error("Invalid EPA sewage outfall response.");
    for (const feature of data.features) {
      const outfall = normalizeSewageOutfall(feature?.attributes);
      if (outfall) outfalls.set(outfall.id, outfall);
      else excludedIds.add(feature?.attributes?.npdes_pfid || feature?.attributes?.OBJECTID || `row:${offset}:${excludedIds.size}`);
    }
    if (!data.exceededTransferLimit) {
      for (const id of outfalls.keys()) excludedIds.delete(id);
      return {
        source: "U.S. EPA National Combined Sewer Overflow Inventory", sourceUrl: SEWAGE_SOURCE_URL,
        refreshFrequency: "weekly", retrievedAt: new Date().toISOString(),
        total: outfalls.size, excludedOutfallCount: excludedIds.size,
        outfalls: [...outfalls.values()].sort((a, b) => a.facilityName.localeCompare(b.facilityName) || a.id.localeCompare(b.id)),
      };
    }
    if (!data.features.length) throw new Error("EPA returned an empty incomplete outfall page.");
    offset += data.features.length;
  }
  throw new Error("EPA sewage outfall pagination exceeded its safety limit.");
}

export function getSewageOutfalls() {
  return getCached("environment:sewageDischarge:v1", 24 * 60 * 60 * 1000, () => fetchSewageOutfalls());
}
