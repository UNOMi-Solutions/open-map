/**
 * Downloads CDC PLACES county measures (2021, age-adjusted prevalence) from data.cdc.gov
 * and writes client/public/data/health/{layerId}.json as { "01001": 12.3, ... }.
 *
 * Run: node scripts/fetch-health-places.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "client", "public", "data", "health");
const BASE = "https://data.cdc.gov/resource/h3ej-a9ec.json";
const DEFAULT_YEAR = "2021";
const DATA_VALUE_TYPE = "Age-adjusted prevalence";

/** layerId -> { measureid, year?, invertFromPercent? } — screening measures use 2020 in this release */
const LAYER_SPECS = [
  { id: "heart-disease", measureid: "CHD" },
  { id: "cancer", measureid: "CANCER" },
  { id: "breast-cancer", measureid: "MAMMOUSE", year: "2020" },
  { id: "diabetes", measureid: "DIABETES" },
  { id: "colon-cancer", measureid: "COLON_SCREEN", year: "2020" },
  { id: "lung-cancer", measureid: "COPD" },
  { id: "kidney-disease", measureid: "KIDNEY" },
  { id: "smokers", measureid: "CSMOKING" },
  { id: "obesity", measureid: "OBESITY" },
  { id: "alcoholism", measureid: "BINGE" },
  { id: "mental-health", measureid: "DEPRESSION" },
  { id: "worst-healthcare-coverage", measureid: "ACCESS2" },
  {
    id: "best-healthcare-coverage",
    measureid: "ACCESS2",
    invertFromPercent: true,
  },
  { id: "most-out-of-shape-population", measureid: "LPA" },
  {
    id: "healthiest-population",
    measureid: "GHLTH",
    invertFromPercent: true,
  },
];

function buildWhere(measureid, year) {
  return `measureid='${measureid}' AND year='${year}' AND data_value_type='${DATA_VALUE_TYPE}'`;
}

async function fetchMeasureRows(measureid, year) {
  const where = buildWhere(measureid, year);
  const limit = 5000;
  let offset = 0;
  const all = [];
  for (;;) {
    const url = `${BASE}?$where=${encodeURIComponent(where)}&$limit=${limit}&$offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
  }
  return all;
}

function rowToMap(rows, { invertFromPercent }) {
  const out = {};
  for (const row of rows) {
    const geoid = String(row.locationid ?? "").padStart(5, "0");
    const raw = row.data_value;
    if (!geoid || raw == null || raw === "") continue;
    const v = parseFloat(String(raw));
    if (!Number.isFinite(v)) continue;
    const value = invertFromPercent ? Math.max(0, Math.min(100, 100 - v)) : v;
    out[geoid] = Math.round(value * 1000) / 1000;
  }
  return out;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const meta = {
    source: "https://data.cdc.gov/500-Cities-Places/PLACES-Local-Data-for-Better-Health-County-Data-20/h3ej-a9ec",
    defaultYear: DEFAULT_YEAR,
    dataValueType: DATA_VALUE_TYPE,
    fetchedAt: new Date().toISOString(),
    layers: {},
  };

  for (const spec of LAYER_SPECS) {
    const year = spec.year ?? DEFAULT_YEAR;
    process.stdout.write(`Fetching ${spec.id} (${spec.measureid}, ${year})... `);
    const rows = await fetchMeasureRows(spec.measureid, year);
    const map = rowToMap(rows, { invertFromPercent: Boolean(spec.invertFromPercent) });
    const dest = join(OUT_DIR, `${spec.id}.json`);
    writeFileSync(dest, JSON.stringify(map), "utf8");
    meta.layers[spec.id] = {
      measureid: spec.measureid,
      year,
      countyCount: Object.keys(map).length,
      invertFromPercent: Boolean(spec.invertFromPercent),
    };
    console.log(`${Object.keys(map).length} counties → ${dest}`);
  }

  writeFileSync(
    join(OUT_DIR, "_meta.json"),
    JSON.stringify(meta, null, 2),
    "utf8"
  );
  console.log("Wrote _meta.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
