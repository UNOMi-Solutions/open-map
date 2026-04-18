/**
 * Fetches current U.S. senators from GovTrack (public API) and writes
 * client/public/data/senators.json with map coordinates per state.
 * Run: node scripts/fetch-senators.mjs
 */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Approximate geographic centers by state postal code (for pin placement). */
const STATE_CENTERS = {
  AL: [32.806671, -86.79113],
  AK: [61.370716, -152.404419],
  AZ: [33.729759, -111.431221],
  AR: [34.969704, -92.373123],
  CA: [36.116203, -119.681564],
  CO: [39.059811, -105.311104],
  CT: [41.597782, -72.755371],
  DE: [39.318523, -75.507141],
  FL: [27.766279, -81.686783],
  GA: [33.040619, -83.643074],
  HI: [21.094318, -157.498337],
  ID: [44.240459, -114.478828],
  IL: [40.349457, -88.986137],
  IN: [39.849426, -86.258278],
  IA: [42.011539, -93.210526],
  KS: [38.5266, -96.726486],
  KY: [37.66814, -84.670067],
  LA: [31.169546, -91.867805],
  ME: [44.693947, -69.381927],
  MD: [39.063946, -76.802101],
  MA: [42.230171, -71.530106],
  MI: [43.326618, -84.536095],
  MN: [45.694454, -93.900192],
  MS: [32.741646, -89.678696],
  MO: [38.456085, -92.288368],
  MT: [46.921925, -110.454353],
  NE: [41.12537, -98.268082],
  NV: [38.313515, -117.055374],
  NH: [43.452492, -71.563896],
  NJ: [40.298904, -74.521011],
  NM: [34.840515, -106.248482],
  NY: [42.165726, -74.948051],
  NC: [35.630066, -79.806419],
  ND: [47.528912, -99.784012],
  OH: [40.388783, -82.764915],
  OK: [35.565342, -96.928917],
  OR: [44.572021, -122.070934],
  PA: [40.590752, -77.209755],
  RI: [41.680893, -71.51178],
  SC: [33.856892, -80.945007],
  SD: [44.299782, -99.438828],
  TN: [35.747845, -86.692345],
  TX: [31.054487, -97.563461],
  UT: [40.150032, -111.862434],
  VT: [44.045876, -72.710686],
  VA: [37.769337, -78.169968],
  WA: [47.400902, -121.490494],
  WV: [38.491226, -80.954453],
  WI: [44.268543, -89.616508],
  WY: [42.755966, -107.30249],
};

function offsetCoords(state, indexInState) {
  const base = STATE_CENTERS[state] ?? [39.8283, -98.5795];
  const dLat = indexInState === 0 ? 0.22 : -0.22;
  const dLng = indexInState === 0 ? -0.32 : 0.32;
  return [base[0] + dLat, base[1] + dLng];
}

/** GovTrack profile URLs end with numeric person id; static portraits use the same id. */
function photoUrlFromGovTrackLink(link) {
  if (!link || typeof link !== "string") return null;
  const m = link.trim().match(/\/(\d+)\s*$/);
  if (!m) return null;
  return `https://www.govtrack.us/static/legislator-photos/${m[1]}-200px.jpeg`;
}

async function main() {
  const url =
    "https://www.govtrack.us/api/v2/role?current=true&role_type=senator&limit=100";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GovTrack ${res.status}`);
  const data = await res.json();
  const objects = data.objects ?? [];

  const byState = new Map();
  for (const role of objects) {
    const st = role.state;
    if (!st) continue;
    if (!byState.has(st)) byState.set(st, []);
    byState.get(st).push(role);
  }

  const out = [];
  for (const [state, roles] of byState) {
    roles.sort((a, b) => {
      const ra = a.senator_rank === "senior" ? 0 : 1;
      const rb = b.senator_rank === "senior" ? 0 : 1;
      if (ra !== rb) return ra - rb;
      const na = a.person?.lastname ?? "";
      const nb = b.person?.lastname ?? "";
      return na.localeCompare(nb);
    });
    roles.forEach((role, i) => {
      const [lat, lng] = offsetCoords(state, i);
      const person = role.person ?? {};
      const link = person.link ?? "";
      out.push({
        id: `sen-${person.id ?? role.id ?? `${state}-${i}`}`,
        name: person.name ?? `${person.firstname ?? ""} ${person.lastname ?? ""}`.trim(),
        state,
        party: role.party ?? "",
        description: role.description ?? "",
        rank: role.senator_rank_label ?? role.senator_rank ?? "",
        website: role.website ?? link,
        photoUrl: photoUrlFromGovTrackLink(link),
        lat,
        lng,
      });
    });
  }

  out.sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));

  const payload = {
    source: "https://www.govtrack.us/api/v2/role (current senators)",
    fetchedAt: new Date().toISOString(),
    count: out.length,
    senators: out,
  };

  const dest = join(__dirname, "..", "client", "public", "data", "senators.json");
  writeFileSync(dest, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${out.length} senators to ${dest}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
