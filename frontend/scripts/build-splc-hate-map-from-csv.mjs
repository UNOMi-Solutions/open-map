/**
 * Aggregates SPLC Hate Map CSV rows by state → 2-digit state GEOIDs (matching /geo/us-states.geojson feature ids).
 *
 * Usage:
 *   npm run data:splc
 *   npm run data:splc -- path/to/my-splc-download.csv
 *
 * Default input: scripts/fixtures/splc-hate-map-sample.csv
 * Output: client/public/data/splc/by-state-geoid.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "client", "public", "data", "splc");
const OUT_JSON = join(OUT_DIR, "by-state-geoid.json");
const DEFAULT_INPUT = join(__dirname, "fixtures", "splc-hate-map-sample.csv");

/** Normalize to 2-char state FIPS (US states + DC) */
const STATE_NAME_TO_GEOID = {
  alabama: "01",
  alaska: "02",
  arizona: "04",
  arkansas: "05",
  california: "06",
  colorado: "08",
  connecticut: "09",
  delaware: "10",
  "district of columbia": "11",
  florida: "12",
  georgia: "13",
  hawaii: "15",
  idaho: "16",
  illinois: "17",
  indiana: "18",
  iowa: "19",
  kansas: "20",
  kentucky: "21",
  louisiana: "22",
  maine: "23",
  maryland: "24",
  massachusetts: "25",
  michigan: "26",
  minnesota: "27",
  mississippi: "28",
  missouri: "29",
  montana: "30",
  nebraska: "31",
  nevada: "32",
  "new hampshire": "33",
  "new jersey": "34",
  "new mexico": "35",
  "new york": "36",
  "north carolina": "37",
  "north dakota": "38",
  ohio: "39",
  oklahoma: "40",
  oregon: "41",
  pennsylvania: "42",
  "rhode island": "44",
  "south carolina": "45",
  "south dakota": "46",
  tennessee: "47",
  texas: "48",
  utah: "49",
  vermont: "50",
  virginia: "51",
  washington: "53",
  "west virginia": "54",
  wisconsin: "55",
  wyoming: "56",
};

const STATE_ABBR_TO_GEOID = {
  AL: "01",
  AK: "02",
  AZ: "04",
  AR: "05",
  CA: "06",
  CO: "08",
  CT: "09",
  DE: "10",
  DC: "11",
  FL: "12",
  GA: "13",
  HI: "15",
  ID: "16",
  IL: "17",
  IN: "18",
  IA: "19",
  KS: "20",
  KY: "21",
  LA: "22",
  ME: "23",
  MD: "24",
  MA: "25",
  MI: "26",
  MN: "27",
  MS: "28",
  MO: "29",
  MT: "30",
  NE: "31",
  NV: "32",
  NH: "33",
  NJ: "34",
  NM: "35",
  NY: "36",
  NC: "37",
  ND: "38",
  OH: "39",
  OK: "40",
  OR: "41",
  PA: "42",
  RI: "44",
  SC: "45",
  SD: "46",
  TN: "47",
  TX: "48",
  UT: "49",
  VT: "50",
  VA: "51",
  WA: "53",
  WV: "54",
  WI: "55",
  WY: "56",
};

/** Minimal RFC-style CSV parsing (handles quoted fields). */
function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  while (i < content.length) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r" || c === "\n") {
      row.push(field);
      field = "";
      if (c === "\r" && content[i + 1] === "\n") i++;
      i++;
      if (row.some((cell) => String(cell).trim().length))
        rows.push(row);
      row = [];
      continue;
    }
    field += c;
    i++;
  }
  row.push(field);
  if (row.some((cell) => String(cell).trim().length)) rows.push(row);
  return rows;
}

function normalizeStateToken(raw) {
  const s = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  return s;
}

function stateToGeoid(raw) {
  const t = String(raw ?? "").trim();
  const upper = t.toUpperCase();
  if (STATE_ABBR_TO_GEOID[upper]) return STATE_ABBR_TO_GEOID[upper];
  const n = normalizeStateToken(t);
  if (STATE_NAME_TO_GEOID[n]) return STATE_NAME_TO_GEOID[n];
  return null;
}

function findStateColumn(headers) {
  const lower = headers.map((h, i) => ({ i, h: String(h).trim().toLowerCase() }));
  const prefers = [/state\b/, /^state$/i, /^location$/];
  for (const re of prefers) {
    const hit = lower.find((x) => re.test(x.h));
    if (hit) return hit.i;
  }
  const fuzzy = lower.findIndex((x) => x.h.includes("state"));
  return fuzzy >= 0 ? fuzzy : -1;
}

function main() {
  const inputPath =
    process.argv[2] && !process.argv[2].startsWith("-")
      ? process.argv[2]
      : DEFAULT_INPUT;

  const text = readFileSync(inputPath, "utf8");
  const rows = parseCsv(text);
  if (!rows.length) throw new Error("Empty CSV");

  const headers = rows[0];
  const dataRows = rows.slice(1);

  let stateIdx = findStateColumn(headers);
  if (stateIdx < 0) {
    const nonEmptyCols = [];
    const maxCols = headers.length;
    for (let ci = 0; ci < maxCols; ci++) {
      let has = false;
      for (const r of dataRows) {
        if (r[ci]?.trim()) {
          has = true;
          break;
        }
      }
      if (has) nonEmptyCols.push(ci);
    }
    if (nonEmptyCols.length >= 2) stateIdx = nonEmptyCols[0];
    else throw new Error("Could not find a column that looks like U.S. state");
  }

  const counts = {};
  let skippedState = 0;

  for (const r of dataRows) {
    const cell = r[stateIdx]?.trim?.() ?? r[stateIdx];
    const geo = stateToGeoid(cell);
    if (!geo) {
      skippedState++;
      continue;
    }
    counts[geo] = (counts[geo] ?? 0) + 1;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const out = {
    source: SPLC_HATE_MAP_CREDIT_LINE,
    importNote:
      "Row count by state HQ from SPLC Hate Map CSV. Re-run npm run data:splc after exporting a new file from splcenter.org/hate-map.",
    inputFile: inputPath.replace(/\\/g, "/"),
    generatedAt: new Date().toISOString(),
    skippedUnmappedRows: skippedState,
    byStateGeoid: counts,
  };

  writeFileSync(OUT_JSON, JSON.stringify(out, null, 2), "utf8");
  const sum = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`Wrote ${OUT_JSON}`);
  console.log(`  States with data: ${Object.keys(counts).length}`);
  console.log(`  Total group listings counted: ${sum}`);
  console.log(`  Rows skipped (unmapped state text): ${skippedState}`);
}

const SPLC_HATE_MAP_CREDIT_LINE =
  "Southern Poverty Law Center — https://www.splcenter.org/hate-map (download CSV)";

try {
  main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
