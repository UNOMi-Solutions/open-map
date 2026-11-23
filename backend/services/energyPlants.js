import axios from "axios";
import { getCached } from "../utils/dataCache.js";

export const ENERGY_SOURCE_URL = "https://www.eia.gov/electricity/data/eia860m/";
const API_URL = "https://api.eia.gov/v2/electricity/operating-generator-capacity/";
const TYPES = { SUN: "solar", WND: "wind", WAT: "hydro" };
const PAGE_SIZE = 5000;

function number(value, min, max = Infinity) {
  if (!["number", "string"].includes(typeof value) || String(value).trim() === "") return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= min && result <= max ? result : null;
}

async function fetchEiaJson(path, params = new URLSearchParams()) {
  // Keep the free EIA key server-side; the public demo key supports local previews.
  params.set("api_key", process.env.EIA_API_KEY || "DEMO_KEY");
  const { data } = await axios.get(`${API_URL}${path}`, { params, timeout: 45000 });
  if (data?.error || !data?.response) throw new Error("EIA returned an invalid response.");
  return data.response;
}

// Use reported generator coordinates and capacity, never guessed locations or zero-filled gaps.
export function normalizeEnergyGenerator(row, period) {
  if (!row || row.period !== period || row.status !== "OP" || !TYPES[row.energy_source_code]) return null;
  const id = String(row.plantid ?? "");
  const generatorId = String(row.generatorid ?? "").trim();
  const latitude = number(row.latitude, -90, 90);
  const longitude = number(row.longitude, -180, 180);
  const capacityMw = number(row["nameplate-capacity-mw"], 0);
  if (!/^\d+$/.test(id) || !generatorId || latitude === null || longitude === null || capacityMw === null || (latitude === 0 && longitude === 0)) return null;
  return {
    id, generatorId, latitude, longitude, capacityMw, type: TYPES[row.energy_source_code],
    name: String(row.plantName || `Plant ${id}`), state: String(row.stateid || ""),
    county: String(row.county || ""), operator: String(row.entityName || ""),
    technology: String(row.technology || "Not specified"),
  };
}

// Discover the latest published month and page one complete snapshot before aggregating plants.
export async function fetchEnergyPlants(fetchJson = fetchEiaJson) {
  const metadata = await fetchJson("");
  const period = metadata.endPeriod;
  if (typeof period !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error("EIA has no valid latest reporting month.");
  const plants = new Map();
  const generators = new Set();
  let offset = 0;
  let expectedTotal;
  let excludedGeneratorCount = 0;
  for (let page = 0; page < 100; page += 1) {
    const query = new URLSearchParams({ frequency: "monthly", start: period, end: period, offset: String(offset), length: String(PAGE_SIZE) });
    for (const code of Object.keys(TYPES)) query.append("facets[energy_source_code][]", code);
    query.append("facets[status][]", "OP");
    for (const field of ["latitude", "longitude", "county", "nameplate-capacity-mw"]) query.append("data[]", field);
    for (const [index, field] of ["plantid", "generatorid"].entries()) {
      query.set(`sort[${index}][column]`, field);
      query.set(`sort[${index}][direction]`, "asc");
    }
    const response = await fetchJson("data/", query);
    const total = number(response.total, 0);
    if (!Number.isInteger(total) || !Array.isArray(response.data) || offset + response.data.length > total || (expectedTotal !== undefined && total !== expectedTotal)) throw new Error("EIA returned an invalid or changing snapshot.");
    expectedTotal = total;
    if (offset < total && response.data.length === 0) throw new Error("EIA returned an incomplete page.");
    for (const row of response.data) {
      if (row?.period !== period) throw new Error("EIA returned mixed reporting months.");
      const generator = normalizeEnergyGenerator(row, period);
      if (!generator) { excludedGeneratorCount += 1; continue; }
      const key = `${generator.id}:${generator.generatorId}`;
      if (generators.has(key)) continue;
      generators.add(key);
      let plant = plants.get(generator.id);
      if (!plant) {
        plant = { id: generator.id, name: generator.name, state: generator.state, county: generator.county,
          operator: generator.operator, latitude: generator.latitude, longitude: generator.longitude,
          capacityMw: 0, generatorCount: 0, types: {} };
        plants.set(plant.id, plant);
      }
      const type = plant.types[generator.type] ??= { capacityMw: 0, generatorCount: 0, technologies: [] };
      type.capacityMw += generator.capacityMw;
      type.generatorCount += 1;
      if (!type.technologies.includes(generator.technology)) type.technologies.push(generator.technology);
      plant.capacityMw += generator.capacityMw;
      plant.generatorCount += 1;
    }
    offset += response.data.length;
    if (offset >= total) {
      return { source: "U.S. Energy Information Administration (EIA-860/860M)", sourceUrl: ENERGY_SOURCE_URL,
        period, refreshFrequency: "monthly", retrievedAt: new Date().toISOString(), excludedGeneratorCount,
        total: plants.size, plants: Array.from(plants.values()).sort((a, b) => a.name.localeCompare(b.name)) };
    }
  }
  throw new Error("EIA pagination exceeded its safety limit.");
}

export function getEnergyPlants() {
  return getCached("environment:energyPlants:v1", 24 * 60 * 60 * 1000, () => fetchEnergyPlants());
}
