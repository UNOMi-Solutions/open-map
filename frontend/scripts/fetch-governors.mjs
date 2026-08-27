/**
 * Builds client/public/data/governors.json — one current governor per state (50).
 * Source: Open States people repo (executive YAML with role type governor).
 * https://github.com/openstates/people
 *
 * Run: node scripts/fetch-governors.mjs
 */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const US_STATE_LOWER = new Set([
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga", "hi", "id", "il", "in", "ia",
  "ks", "ky", "la", "me", "md", "ma", "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh", "nj",
  "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri", "sc", "sd", "tn", "tx", "ut", "vt",
  "va", "wa", "wv", "wi", "wy",
]);

const REPO_YML =
  /^data\/([a-z]{2})\/executive\/[^/]+\.yml$/;

/**
 * When Open States has no executive YAML with role `governor` (e.g. WV currently
 * only lists another statewide executive), fill from a manual row.
 */
const GOVERNOR_FALLBACK_BY_STATE = {
  WV: {
    name: "Patrick Morrisey",
    party: "Republican",
    website: "https://governor.wv.gov/",
    ocdId: "morrisey-wv-manual",
  },
};

/**
 * Replace Open States YAML pick when it is stale (e.g. former governor file still
 * lists `type: governor` or sorts before the incumbent). Remove a state when upstream
 * matches reality again.
 */
const GOVERNOR_OVERRIDE_BY_STATE = {
  SD: {
    name: "Larry Rhoden",
    party: "Republican",
    website: "https://governor.sd.gov/",
    photoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Larry_Rhoden_2025_%28cropped%29.jpg/400px-Larry_Rhoden_2025_%28cropped%29.jpg",
    ocdId: "larryrho",
  },
};

/** @returns {{ name: string, party: string, photoUrl: string, website: string, ocdId: string } | null} */
function parseGovernorYaml(text) {
  if (!/\n\s*type:\s*governor\b/m.test(text)) return null;

  const name = text.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  if (!name) return null;

  const partyMatch = text.match(/^party:\s*\n(?:[^\n]+\n)*?-\s*name:\s*(.+)$/m);
  const party = partyMatch?.[1]?.trim() ?? "";

  let photoUrl = text.match(/^image:\s*(.+)$/m)?.[1]?.trim() ?? "";
  if (photoUrl.startsWith('"') && photoUrl.endsWith('"')) photoUrl = photoUrl.slice(1, -1);

  const website = text.match(/^links:\s*\n-\s*url:\s*(.+)$/m)?.[1]?.trim() ?? "";

  const ocdLine = text.match(/^id:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const ocdId = ocdLine.replace(/^ocd-person\//, "") || name.replace(/\s+/g, "-").toLowerCase();

  return { name, party, photoUrl, website, ocdId };
}

async function fetchText(url, headers = {}) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "OpenMapGovernorsFetch/1.0 (https://github.com/openmap)",
      Accept: "application/vnd.github+json",
      ...headers,
    },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

async function main() {
  const treeUrl = "https://api.github.com/repos/openstates/people/git/trees/main?recursive=1";
  const treeJson = await fetchText(treeUrl);
  const tree = JSON.parse(treeJson);
  const byState = new Map();
  for (const item of tree.tree ?? []) {
    if (item.type !== "blob" || !item.path) continue;
    const m = item.path.match(REPO_YML);
    if (!m) continue;
    const st = m[1];
    if (!US_STATE_LOWER.has(st)) continue;
    if (!byState.has(st)) byState.set(st, []);
    byState.get(st).push(item.path);
  }

  const governors = [];
  const rawBase = "https://raw.githubusercontent.com/openstates/people/main/";

  for (const st of [...US_STATE_LOWER].sort()) {
    const paths = byState.get(st) ?? [];
    if (!paths.length) {
      console.warn(`No executive YAML for state ${st}`);
      continue;
    }
    let found = null;
    for (const p of paths) {
      const yml = await fetchText(rawBase + p, { Accept: "text/plain" });
      const parsed = parseGovernorYaml(yml);
      if (parsed) {
        found = parsed;
        break;
      }
    }
    if (!found) {
      const fb = GOVERNOR_FALLBACK_BY_STATE[st.toUpperCase()];
      if (fb) {
        found = {
          name: fb.name,
          party: fb.party,
          photoUrl: fb.photoUrl ?? "",
          website: fb.website ?? "",
          ocdId: fb.ocdId,
        };
      } else {
        console.warn(`No governor role found in YAML for ${st}`);
        continue;
      }
    }
    const ST = st.toUpperCase();
    const hard = GOVERNOR_OVERRIDE_BY_STATE[ST];
    if (hard) {
      found = {
        name: hard.name,
        party: hard.party,
        photoUrl: hard.photoUrl ?? "",
        website: hard.website ?? "",
        ocdId: hard.ocdId,
      };
    }
    const [lat, lng] = STATE_CENTERS[ST] ?? [39.8283, -98.5795];
    governors.push({
      id: `gov-${ST}-${found.ocdId.slice(0, 8)}`,
      name: found.name,
      state: ST,
      party: found.party,
      description: `Governor of ${stateNameFromPostal(ST)}`,
      website: found.website || undefined,
      photoUrl: found.photoUrl || undefined,
      lat,
      lng,
    });
  }

  governors.sort((a, b) => a.state.localeCompare(b.state));

  const payload = {
    source: "https://github.com/openstates/people (executive YAML, role type governor)",
    fetchedAt: new Date().toISOString(),
    count: governors.length,
    governors,
  };

  const dest = join(__dirname, "..", "client", "public", "data", "governors.json");
  writeFileSync(dest, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${governors.length} governors to ${dest}`);
  if (governors.length !== 50) {
    console.warn(`Expected 50 states, got ${governors.length}`);
  }
}

function stateNameFromPostal(code) {
  const names = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
    CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
    IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
    ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
    MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
    NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
    ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
    RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
    UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
    WI: "Wisconsin", WY: "Wyoming",
  };
  return names[code] ?? code;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
