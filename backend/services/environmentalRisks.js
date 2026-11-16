import axios from "axios";
import Papa from "papaparse";
import fs from "node:fs";
import csvParser from "csv-parser";
import { getCached, mapWithConcurrency } from "../utils/dataCache.js";
import { STATE_CENTERS } from "../lib/usStateCenters.js";

const TTL = 24 * 60 * 60 * 1000;
export const FF_API = "https://fracfocus.org/api/api/fracfocus/search";
export const SDW_API = "https://echodata.epa.gov/echo/";
export const SOURCES = {
  fracking: "https://www.fracfocus.org/wells",
  runoff: "https://www.epa.gov/toxics-release-inventory-tri-program/tri-basic-data-files-calendar-years-1987-present",
  drinkingWater: "https://echo.epa.gov/tools/web-services/facility-search-drinking-water",
};
const stateNames = new Map(JSON.parse(fs.readFileSync(new URL("../data/fracking-states.json", import.meta.url))).map(s => [s.code, s.name]));
const nameToCode = new Map([...stateNames].map(([code, name]) => [name.toLowerCase(), code]));
const request = async (url, params) => (await axios.get(url, { params, timeout: 60000, maxContentLength: 40 * 1024 * 1024 })).data;

export function validState(state) { return typeof state === "string" && Object.hasOwn(STATE_CENTERS, state); }
export function validYear(year, start) { return /^20\d{2}$/.test(String(year)) && Number(year) >= start && Number(year) <= new Date().getUTCFullYear(); }
export function numberOrNull(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (String(value).trim() === "") return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function coords(lat, lon) {
  if (![lat, lon].every(v => ["string", "number"].includes(typeof v) && String(v).trim())) return null;
  const latitude = Number(lat), longitude = Number(lon);
  // Only U.S. locations; do not substitute office addresses or centroids for missing points.
  return latitude >= 15 && latitude <= 73 && longitude >= -180 && longitude <= -60 ? { latitude, longitude } : null;
}
function jobDate(value) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/.exec(String(value));
  if (!match) return null;
  const [, m, d, y] = match;
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

export function normalizeFracking(row, year) {
  const location = coords(row.Latitude, row.Longitude);
  const date = jobDate(row.JobEndDate);
  const api = String(row.APINumber || "");
  const state = nameToCode.get(String(row.StateName || "").toLowerCase());
  if (!location || !/^\d{10,14}$/.test(api) || !date || !date.startsWith(`${year}-`) || !state) return null;
  return {
    id: api, name: String(row.WellName || api), state, ...location, date,
    sourceUrl: `https://www.fracfocus.org/wells/${api}`,
    details: [
      ["Operator", String(row.OperatorClean || "Not reported")], ["State", state], ["County", String(row.CountyName || "Not reported")],
      ["API well number", api], ["Job completed", date],
      ["Base water", numberOrNull(row.TotalBaseWaterVolume) === null ? "Not reported" : `${numberOrNull(row.TotalBaseWaterVolume).toLocaleString("en-US")} gallons`],
      ["True vertical depth", numberOrNull(row.TVD) === null ? "Not reported" : `${numberOrNull(row.TVD).toLocaleString("en-US")} feet`],
    ],
  };
}

// FracFocus's state_code search currently returns HTTP 500. Query the entire year,
// exhaust every page and validate dates before serving the national inventory.
export async function fetchFracking(year, fetchData = request) {
  const params = { start_date: `${year}-01-01`, end_date: `${year}-12-31`, page: 1, pagesize: 1000 };
  const first = await fetchData(FF_API, params);
  const count = numberOrNull(first?.Count);
  if (count === null || !Number.isInteger(count) || count > 200000 || !Array.isArray(first?.Wells)) throw new Error("Invalid FracFocus inventory");
  const pages = Math.ceil(count / 1000);
  const rest = await mapWithConcurrency(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => i + 2), 3, async page => {
    const data = await fetchData(FF_API, { ...params, page });
    if (Number(data?.Count) !== count || !Array.isArray(data?.Wells)) throw new Error("FracFocus inventory changed during paging; retry");
    return data.Wells;
  });
  const rows = [...first.Wells, ...rest.flat()];
  if (rows.length !== count) throw new Error("Incomplete FracFocus inventory");
  const wells = new Map();
  let excluded = 0;
  for (const row of rows) {
    const record = normalizeFracking(row, year);
    if (!record) { excluded++; continue; }
    // Multiple jobs at one well should not inflate location cluster counts.
    if (!wells.has(record.id) || wells.get(record.id).date < record.date) wells.set(record.id, record);
  }
  return { sourceUrl: SOURCES.fracking, retrievedAt: new Date().toISOString(), year, excluded, points: [...wells.values()] };
}

export function normalizeRunoff(rows, state, year) {
  const facilities = new Map();
  let excluded = 0;
  for (const row of rows) {
    if (String(row["1. YEAR"]) !== String(year) || (state && row["8. ST"] !== state) || !validState(row["8. ST"])) continue;
    const amount = numberOrNull(row["53. 5.3 - WATER"]);
    if (amount === null || amount === 0) continue;
    const id = String(row["2. TRIFD"] || "");
    const location = coords(row["12. LATITUDE"], row["13. LONGITUDE"]);
    const unit = String(row["50. UNIT OF MEASURE"] || "").toLowerCase();
    if (!id || !location || !["pounds", "grams"].includes(unit)) { excluded++; continue; }
    // Retain per-chemical units. Dioxin grams must never be summed with pounds.
    let facility = facilities.get(id);
    if (!facility) {
      facility = { id, name: String(row["4. FACILITY NAME"] || id), state: row["8. ST"], ...location,
        sourceUrl: `https://enviro.epa.gov/facts/tri/ef-facilities/#/Facility/${encodeURIComponent(id)}`,
        details: [["Reporting year", String(year)], ["State", row["8. ST"]], ["City / county", `${row["6. CITY"] || ""}, ${row["7. COUNTY"] || ""}`], ["Industry", String(row["23. INDUSTRY SECTOR"] || "Not reported")]], chemicals: new Map() };
      facilities.set(id, facility);
    }
    const chemical = String(row["37. CHEMICAL"] || "Unspecified chemical");
    const key = `${chemical}:${unit}`;
    const entry = facility.chemicals.get(key) || { name: chemical, unit, amount: 0 };
    entry.amount += amount;
    facility.chemicals.set(key, entry);
  }
  return { sourceUrl: SOURCES.runoff, retrievedAt: new Date().toISOString(), year, excluded,
    points: [...facilities.values()].map(({ chemicals, ...facility }) => ({ ...facility,
      details: [...facility.details, ...[...chemicals.values()].sort((a, b) => a.name.localeCompare(b.name)).map(c => [c.name, `${c.amount > 0 && c.amount < 0.000001 ? c.amount.toExponential(3) : c.amount.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${c.unit} to surface water`])] })) };
}
const requestTri = async url => (await axios.get(url, { responseType: "stream", timeout: 180000 })).data;
const TRI_FIELDS = ["1. YEAR", "2. TRIFD", "4. FACILITY NAME", "6. CITY", "7. COUNTY", "8. ST", "12. LATITUDE", "13. LONGITUDE", "23. INDUSTRY SECTOR", "37. CHEMICAL", "50. UNIT OF MEASURE", "53. 5.3 - WATER"];
export async function fetchRunoff(state, year, fetchData = requestTri) {
  const csv = await fetchData(`https://data.epa.gov/efservice/downloads/tri/mv_tri_basic_download/${year}_${state || "US"}/csv`);
  // Stream the national CSV and retain only small water-release records. The raw
  // all-media file is too large to buffer in a production server instance.
  if (typeof csv === "string") {
    if (!csv.startsWith("1. YEAR,")) throw new Error("EPA TRI returned an invalid download");
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    if (parsed.errors.length) throw new Error("Incomplete EPA TRI CSV");
    if (!TRI_FIELDS.every(field => parsed.meta.fields.includes(field))) throw new Error("EPA TRI returned invalid column headers");
    return normalizeRunoff(parsed.data, state, year);
  }
  if (!csv || typeof csv.pipe !== "function") throw new Error("EPA TRI returned an invalid download");
  const parser = csvParser({ strict: true, maxRowBytes: 1024 * 1024 });
  let validHeaders = false;
  parser.on("headers", headers => {
    validHeaders = TRI_FIELDS.every(field => headers.includes(field));
    if (!validHeaders) parser.destroy(new Error("EPA TRI returned invalid column headers"));
  });
  csv.on("error", error => parser.destroy(error));
  const rows = [];
  try {
    for await (const row of csv.pipe(parser)) if (numberOrNull(row["53. 5.3 - WATER"]) > 0) rows.push(Object.fromEntries(TRI_FIELDS.map(field => [field, row[field]])));
  } finally { csv.destroy(); }
  if (!validHeaders) throw new Error("EPA TRI returned an invalid download");
  return normalizeRunoff(rows, state, year);
}

export async function fetchNationalRunoff(year, fetchState = state => getCached(`runoff:${state}:${year}:v2`, TTL, () => fetchRunoff(state, year))) {
  // EPA's all-U.S. CSV export returns HTTP 500 for large reporting years.
  // Fetch its official smaller exports automatically and publish only a complete
  // national inventory. Completed pieces are cached so retries resume cheaply.
  const parts = await mapWithConcurrency(Object.keys(STATE_CENTERS), 4, fetchState);
  const points = new Map();
  for (const part of parts) {
    if (!Array.isArray(part?.points) || part.year !== year) throw new Error("Invalid national TRI partition");
    for (const point of part.points) points.set(point.id, point);
  }
  return { sourceUrl: SOURCES.runoff, retrievedAt: new Date().toISOString(), year,
    excluded: parts.reduce((sum, part) => sum + part.excluded, 0), points: [...points.values()] };
}

export function normalizeWater(rows, compact = false) {
  const systems = new Map();
  let excluded = 0;
  for (const row of rows) {
    if (row.PWSActivityCode !== "A") continue;
    const id = String(row.PWSId || "");
    if (!/^[A-Z0-9]{9}$/.test(id)) { excluded++; continue; }
    const fips = [...new Set(String(row.FIPSCodes || "").match(/\b\d{5}\b/g) || [])].filter(f => !f.endsWith("000"));
    const flag = /^(yes|y)$/i.test(row.HealthFlag) ? true : /^(no|n)$/i.test(row.HealthFlag) ? false : null;
    if (compact && flag !== true) { systems.set(id, { id, fips, flagged: flag }); continue; }
    const registry = String(row.RegistryID || "");
    systems.set(id, { id, name: String(row.PWSName || id), state: String(row.StateCode || ""), fips, flagged: flag,
      sourceUrl: /^\d{10,15}$/.test(registry) ? `https://echo.epa.gov/detailed-facility-report?fid=${registry}` : SOURCES.drinkingWater,
      details: [["System ID", id], ["System type", String(row.PWSTypeDesc || "Not reported")],
        ["Counties served", String(row.CountiesServed || "Not reported")], ["Water source", String(row.PrimarySourceDesc || "Not reported")],
        ["Population served", numberOrNull(row.PopulationServedCount)?.toLocaleString("en-US") ?? "Not reported"],
        ["EPA health-based violation flag", flag === null ? "Not reported" : flag ? "Yes" : "No"],
        ["EPA compliance status", String(row.SNC || "Not reported")],
        ["Current contaminant / rule codes", String(row.SDWAContaminantsInCurViol || "None reported")],
        ["Violation categories", String(row.ViolationCategories || "None reported")]],
    });
  }
  const counties = new Map();
  for (const system of systems.values()) for (const fips of system.fips) {
    const county = counties.get(fips) || { fips, total: 0, flagged: 0, unknown: 0, systemIds: [] };
    county.total++; county.flagged += system.flagged === true ? 1 : 0; county.unknown += system.flagged === null ? 1 : 0;
    if (!compact || system.flagged === true) county.systemIds.push(system.id);
    counties.set(fips, county);
  }
  return { sourceUrl: SOURCES.drinkingWater, retrievedAt: new Date().toISOString(), totalSystems: systems.size,
    systems: [...systems.values()].filter(s => !compact || s.flagged === true), counties: [...counties.values()], excluded,
    unmappedSystems: [...systems.values()].filter(s => !s.fips.length).length };
}
export async function fetchDrinkingWater(state, fetchData = request) {
  if (!state) {
    // ECHO caps individual queries below the national system count. Retrieve the
    // ten EPA regions automatically, then deduplicate into one national snapshot.
    const partitions = await mapWithConcurrency(Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, "0")), 2,
      region => fetchWaterRows({ p_reg: region }, fetchData, 5000));
    return normalizeWater(partitions.flat(), true);
  }
  return normalizeWater(await fetchWaterRows({ p_st: state }, fetchData));
}
async function fetchWaterRows(filters, fetchData, pageSize = 1000) {
  const qcolumns = "1,2,4,6,7,8,11,13,14,15,22,43,48,49,62";
  const search = (await fetchData(`${SDW_API}sdw_rest_services.get_systems`, { output: "JSON", ...filters, p_act: "Y", responseset: pageSize, qcolumns }))?.Results;
  const count = numberOrNull(search?.QueryRows);
  if (search?.Error || count === null || !Number.isInteger(count) || count > 50000) throw new Error("Invalid EPA drinking water search");
  if (count === 0) return [];
  if (!/^\d+$/.test(String(search.QueryID))) throw new Error("EPA returned no query ID");
  const pages = await mapWithConcurrency(Array.from({ length: Math.ceil(count / pageSize) }, (_, i) => i + 1), 2, async pageno => {
    const page = (await fetchData(`${SDW_API}sdw_rest_services.get_qid`, { output: "JSON", qid: search.QueryID, pageno, qcolumns }))?.Results;
    if (page?.Error || Number(page?.QueryRows) !== count || !Array.isArray(page?.WaterSystems)) throw new Error("Invalid EPA drinking water page");
    return page.WaterSystems;
  });
  const rows = pages.flat();
  if (rows.length !== count || new Set(rows.map(r => r.PWSId)).size !== count) throw new Error("Incomplete EPA drinking water inventory");
  return rows;
}

export async function getEnvironmentalRisk(kind, state, year) {
  if (kind === "fracking") {
    const data = await getCached(`fracking:${year}:v1`, TTL, () => fetchFracking(year));
    return state ? { ...data, points: data.points.filter(p => p.state === state) } : data;
  }
  return getCached(`${kind}:${state || "US"}:${year || "snapshot"}:v2`, TTL, () => kind === "runoff" ? state ? fetchRunoff(state, year) : fetchNationalRunoff(year) : fetchDrinkingWater(state));
}
