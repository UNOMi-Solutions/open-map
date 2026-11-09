import axios from "axios";
import { getCached } from "../utils/dataCache.js";

export const SUPERFUND_SOURCE_URL = "https://www.epa.gov/superfund";
export const SUPERFUND_QUERY_URL = "https://geopub.epa.gov/ArcGIS/rest/services/NEPAssist/NEPAVELayersPublic_fgdb/MapServer/14/query";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;
const SITE_FIELDS = "OBJECTID,EPA_ID,Site_Name,Address,City,County,State,Zip_Code,NPL_Status,LATITUDE,LONGITUDE,FACILITY_URL";

export function isSuperfundSiteId(value) {
  return typeof value === "string" && /^[A-Z0-9]{12}$/.test(value);
}

function readCoordinate(value, min, max) {
  if (!["number", "string"].includes(typeof value) || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

// Keep EPA reference coordinates rather than inventing locations for unmappable sites.
export function normalizeSuperfundSite(attributes = {}) {
  if (!attributes || typeof attributes !== "object") return null;
  const id = attributes.EPA_ID;
  const latitude = readCoordinate(attributes.LATITUDE, -90, 90);
  const longitude = readCoordinate(attributes.LONGITUDE, -180, 180);
  if (!isSuperfundSiteId(id) || latitude === null || longitude === null || (latitude === 0 && longitude === 0)) return null;
  return {
    id,
    name: String(attributes.Site_Name || id),
    address: String(attributes.Address || ""),
    city: String(attributes.City || ""),
    county: String(attributes.County || ""),
    state: String(attributes.State || ""),
    zipCode: String(attributes.Zip_Code || ""),
    status: String(attributes.NPL_Status || "Not specified"),
    latitude,
    longitude,
    sourceUrl: `https://enviro.epa.gov/envirofacts/sems/detail-view?id=${id}`,
  };
}

async function fetchEpaJson(params) {
  const { data } = await axios.get(SUPERFUND_QUERY_URL, { params, timeout: 30000 });
  if (data?.error || !Array.isArray(data?.features)) {
    throw new Error("EPA Superfund service returned an invalid response.");
  }
  return data;
}

// Page the EPA list deterministically and de-duplicate sites with multiple boundaries.
export async function fetchSuperfundSites(fetchJson = fetchEpaJson) {
  const sites = new Map();
  const excludedIds = new Set();
  let offset = 0;
  for (let page = 0; page < 50; page += 1) {
    const data = await fetchJson({
      where: "1=1", outFields: SITE_FIELDS, returnGeometry: false,
      orderByFields: "OBJECTID ASC", resultOffset: offset,
      resultRecordCount: PAGE_SIZE, f: "json",
    });
    if (data?.error || !Array.isArray(data?.features)) throw new Error("Invalid EPA Superfund site list.");
    for (const feature of data.features) {
      const site = normalizeSuperfundSite(feature.attributes);
      if (site) sites.set(site.id, site);
      else excludedIds.add(feature.attributes?.EPA_ID || feature.attributes?.OBJECTID);
    }
    if (!data.exceededTransferLimit) {
      for (const id of sites.keys()) excludedIds.delete(id);
      return {
        source: "U.S. EPA Superfund", sourceUrl: SUPERFUND_SOURCE_URL,
        refreshFrequency: "weekly", retrievedAt: new Date().toISOString(),
        total: sites.size, excludedSiteCount: excludedIds.size,
        sites: [...sites.values()].sort((a, b) => a.name.localeCompare(b.name)),
      };
    }
    if (data.features.length === 0) throw new Error("EPA pagination returned an empty incomplete page.");
    offset += data.features.length;
  }
  throw new Error("EPA Superfund pagination exceeded its safety limit.");
}

export function getSuperfundSites() {
  return getCached("environment:superfund:sites:v1", CACHE_TTL_MS, () => fetchSuperfundSites());
}

// Load full WGS84 boundary geometry only for the site whose popup is opened.
export function getSuperfundBoundary(siteId) {
  if (!isSuperfundSiteId(siteId)) throw new Error("Invalid EPA site ID.");
  return getCached(`environment:superfund:boundary:${siteId}`, CACHE_TTL_MS, async () => {
    const data = await fetchEpaJson({
      where: `EPA_ID='${siteId}'`, outFields: "EPA_ID", returnGeometry: true,
      outSR: 4326, f: "geojson", resultRecordCount: 2000,
    });
    if (data.type !== "FeatureCollection" || data.exceededTransferLimit) {
      throw new Error("EPA returned an invalid or incomplete site boundary.");
    }
    return {
      type: "FeatureCollection",
      features: data.features.filter((feature) =>
        ["Polygon", "MultiPolygon"].includes(feature.geometry?.type) &&
        Array.isArray(feature.geometry.coordinates) && feature.geometry.coordinates.length > 0),
    };
  });
}
