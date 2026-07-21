// Import dotenv for hidden variables
import dotenv from "dotenv";
import axios from "axios";
import { offsetCoords, STATE_CENTERS } from "../lib/usStateCenters.js";
import { photoUrlFromGovTrackLink } from "../lib/usStateCenters.js";
dotenv.config();

// Import Router so paths can be passed to index
import { response, Router } from "express";
const router = Router();
function govTrackIdFromLink(link) {
  if (!link || typeof link !== "string") return null;
  return link.trim().match(/\/(\d+)\/?$/)?.[1] ?? null;
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

const REPO_YML =
  /^data\/([a-z]{2})\/executive\/[^/]+\.yml$/;

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

const US_STATE_LOWER = new Set([
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga", "hi", "id", "il", "in", "ia",
  "ks", "ky", "la", "me", "md", "ma", "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh", "nj",
  "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri", "sc", "sd", "tn", "tx", "ut", "vt",
  "va", "wa", "wv", "wi", "wy",
]);

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

router.get("/test", (req, res) => {
  res.json({ response: "Success: Viewing Political Data" });
});

/** Current U.S. senators from GovTrack (no API key required). */
router.get("/senators", async (req, res) => {
  try {
    const response = await axios.get(
      "https://www.govtrack.us/api/v2/role",
      { params: { current: true, role_type: "senator", limit: 100 } }
    );

    const objects = response.data?.objects ?? [];
    const byState = new Map();

    for (const role of objects) {
      const st = role.state;
      if (!st) continue;
      if (!byState.has(st)) byState.set(st, []);
      byState.get(st).push(role);
    }

    const senators = [];
    for (const [state, roles] of byState) {
      roles.sort((a, b) => {
        const ra = a.senator_rank === "senior" ? 0 : 1;
        const rb = b.senator_rank === "senior" ? 0 : 1;
        if (ra !== rb) return ra - rb;
        return (a.person?.lastname ?? "").localeCompare(b.person?.lastname ?? "");
      });

      roles.forEach((role, i) => {
        const [lat, lng] = offsetCoords(state, i);
        const person = role.person ?? {};
        const link = person.link ?? "";
        senators.push({
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

    senators.sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));

    res.json({
      source: "https://www.govtrack.us/api/v2/role (current senators)",
      fetchedAt: new Date().toISOString(),
      count: senators.length,
      senators,
    });
  } catch (error) {
    console.error("Politics senators error:", error.message);
    res.status(error.response?.status || 500).json({
      error: error.message || "Failed to fetch senator data",
    });
  }
});

/** Current U.S. House representatives from GovTrack (no API key required). */
router.get("/representatives", async (req, res) => {
  try {
    const response = await axios.get(
      "https://www.govtrack.us/api/v2/role",
      { params: { current: true, role_type: "representative", limit: 500 } }
    );

    const objects = response.data?.objects ?? [];
    const districts = {};
    for (const role of objects) {
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
      }
    }

    res.json({
      source: "https://www.govtrack.us/api/v2/role (current representatives)",
      fetchedAt: new Date().toISOString(),
      count: Object.keys(districts).length,
      districts,
    });
  } catch (error) {
    console.error("Politics representatives error:", error.message);
    res.status(error.response?.status || 500).json({
      error: error.message || "Failed to fetch representative data",
    });
  }
});

router.get("/governors", async (req, res) => {
  try {
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

    res.json({
      source: "https://github.com/openstates/people (executive YAML, role type governor)",
      fetchedAt: new Date().toISOString(),
      count: governors.length,
      governors,
    });

  } catch (error) {
    console.error("Politics governors error:", error.message);
    res.status(error.response?.status || 500).json({
      error: error.message || "Failed to fetch governor data",
    });
  }
});

router.get("/congressional_geo", async (req, res) => {
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
  res.json(out);
});

router.get("/president", async (req, res) => {
  const DC_PIN = { lat: 38.8977, lng: -77.0365 };
  const url =
    "https://www.govtrack.us/api/v2/role?current=true&role_type=president&limit=5";
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GovTrack ${response.status}`);
  const data = await response.json();
  const role = (data.objects ?? [])[0];
  if (!role) throw new Error("No current president role returned");

  const person = role.person ?? {};
  const link = person.link ?? "";
  res.json({
    source: "https://www.govtrack.us/api/v2/role (current president)",
    fetchedAt: new Date().toISOString(),
    president: {
      id: `pres-${link.match(/\/(\d+)\s*$/)?.[1] ?? "current"}`,
      name: person.name ?? `${person.firstname ?? ""} ${person.lastname ?? ""}`.trim(),
      title: role.title_long ?? role.title ?? "President of the United States",
      party: role.party ?? "",
      description: role.description ?? "",
      website: role.website || link || "",
      photoUrl: photoUrlFromGovTrackLink(link),
      lat: DC_PIN.lat,
      lng: DC_PIN.lng,
    },
  });
});

export default router;
