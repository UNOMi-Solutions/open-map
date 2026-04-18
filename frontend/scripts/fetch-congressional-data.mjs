/**
 * 1) Fetches current U.S. House members from GovTrack → client/public/data/house-district-parties.json
 * 2) Downloads simplified 119th congressional district boundaries from Census ArcGIS → client/public/geo/congressional-119.geojson
 *
 * Run: node scripts/fetch-congressional-data.mjs
 */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function photoUrlFromGovTrackLink(link) {
  if (!link || typeof link !== "string") return null;
  const m = link.trim().match(/\/(\d+)\s*$/);
  if (!m) return null;
  return `https://www.govtrack.us/static/legislator-photos/${m[1]}-200px.jpeg`;
}

/**
 * Only the 50 states get voting seats in the U.S. House (435 total apportioned).
 * GovTrack also returns non-voting delegates (DC, PR, GU, AS, MP, VI) under
 * role_type=representative — those must be excluded to match the 435-member House.
 */
const FIFTY_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL",
  "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT",
  "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

async function fetchHouseParties() {
  const url =
    "https://www.govtrack.us/api/v2/role?current=true&role_type=representative&limit=500";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GovTrack ${res.status}`);
  const data = await res.json();
  const districts = {};
  for (const role of data.objects ?? []) {
    const st = role.state;
    if (!st || !FIFTY_STATE_CODES.has(st)) continue;
    const dist = typeof role.district === "number" ? role.district : 0;
    const key = `${st}-${dist}`;
    const person = role.person ?? {};
    const link = person.link ?? "";
    districts[key] = {
      party: role.party ?? "",
      name: person.name ?? "",
      description: role.description ?? "",
      website: role.website || link,
      photoUrl: photoUrlFromGovTrackLink(link),
    };
  }
  const payload = {
    source:
      "https://www.govtrack.us/api/v2/role (current representatives, 50 states only)",
    note:
      "Excludes non-voting House delegates (DC, PR, GU, AS, MP, VI). Count is below 435 when seats are vacant.",
    votingSeatsApportioned: 435,
    fetchedAt: new Date().toISOString(),
    count: Object.keys(districts).length,
    districts,
  };
  const dest = join(
    __dirname,
    "..",
    "client",
    "public",
    "data",
    "house-district-parties.json"
  );
  writeFileSync(dest, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${payload.count} house districts to ${dest}`);
}

async function fetchCongressionalGeoJson() {
  const base =
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/0/query";
  const pageSize = 200;
  const all = [];
  let offset = 0;
  const query = new URLSearchParams({
    where: "1=1",
    outFields: "STATE,GEOID,NAME",
    outSR: "4326",
    f: "geojson",
    returnGeometry: "true",
    maxAllowableOffset: "0.02",
    resultRecordCount: String(pageSize),
  });

  for (;;) {
    query.set("resultOffset", String(offset));
    const url = `${base}?${query.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Census ArcGIS ${res.status}`);
    const fc = await res.json();
    if (fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
      throw new Error("Unexpected GeoJSON from Census");
    }
    all.push(...fc.features);
    const n = fc.features.length;
    const exceeded =
      fc.exceededTransferLimit === true ||
      fc.properties?.exceededTransferLimit === true;
    if (!exceeded || n === 0) break;
    offset += n;
  }

  const out = { type: "FeatureCollection", features: all };
  const dest = join(
    __dirname,
    "..",
    "client",
    "public",
    "geo",
    "congressional-119.geojson"
  );
  writeFileSync(dest, JSON.stringify(out), "utf8");
  console.log(`Wrote ${all.length} district polygons to ${dest}`);
}

async function main() {
  await fetchHouseParties();
  await fetchCongressionalGeoJson();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
