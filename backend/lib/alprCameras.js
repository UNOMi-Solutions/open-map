// License-plate readers from OpenStreetMap, via the public Overpass API.
// Cameras are tagged surveillance:type=ALPR (ANPR is the British name for the same thing).
// A single nationwide query times out, so the country is loaded one area at a time, cached
// on disk, and drawn at every zoom. Wide views get clusters; close views get each camera.
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const USER_AGENT = "OpenMap/1.0";
const OVERPASS_ENDPOINTS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REGION_TTL_MS = 24 * 60 * 60 * 1000;

const CACHE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "cache", "alpr");
const REGION_DIR = path.join(CACHE_DIR, "regions");
const DATASET_FILE = path.join(CACHE_DIR, "dataset.json");

function box(name, south, west, north, east) {
  return { name, south, west, north, east };
}

/** Slightly padded state boxes. The biggest states are already split. */
const REGIONS = [
  box("GA", 30.35, -85.65, 35.05, -80.75),
  box("FL", 24.4, -87.7, 31.1, -79.9),
  box("TX-S", 25.7, -106.7, 31.1, -93.4),
  box("TX-N", 31.0, -106.7, 36.55, -93.4),
  box("CA-S", 32.5, -121.2, 36.6, -114.0),
  box("CA-N", 36.5, -124.5, 42.1, -117.1),
  box("AZ", 31.3, -114.85, 37.05, -109.0),
  box("NC", 33.8, -84.35, 36.62, -75.4),
  box("NY", 40.45, -79.8, 45.05, -71.85),
  box("IL", 36.95, -91.55, 42.55, -87.45),
  box("AL", 30.15, -88.5, 35.05, -84.85),
  box("SC", 32.03, -83.36, 35.22, -78.54),
  box("TN", 34.98, -90.32, 36.68, -81.64),
  box("VA", 36.54, -83.68, 39.47, -75.24),
  box("OH", 38.4, -84.83, 42.0, -80.51),
  box("PA", 39.72, -80.53, 42.27, -74.69),
  box("NJ", 38.92, -75.57, 41.36, -73.89),
  box("MI", 41.7, -90.42, 48.2, -82.4),
  box("WA", 45.54, -124.8, 49.01, -116.91),
  box("OR", 41.99, -124.6, 46.3, -116.46),
  box("CO", 36.99, -109.1, 41.05, -102.04),
  box("NV", 35.0, -120.01, 42.01, -114.03),
  box("UT", 36.99, -114.06, 42.01, -109.04),
  box("NM", 31.33, -109.06, 37.01, -103.0),
  box("LA", 28.9, -94.1, 33.03, -88.8),
  box("MS", 30.15, -91.66, 35.01, -88.09),
  box("AR", 33.0, -94.65, 36.55, -89.6),
  box("OK", 33.61, -103.01, 37.01, -94.43),
  box("KS", 36.99, -102.06, 40.01, -94.58),
  box("MO", 35.99, -95.78, 40.62, -89.1),
  box("KY", 36.49, -89.58, 39.15, -81.95),
  box("IN", 37.77, -88.1, 41.77, -84.78),
  box("WI", 42.49, -92.9, 47.1, -86.75),
  box("MN", 43.5, -97.25, 49.39, -89.48),
  box("IA", 40.37, -96.65, 43.51, -90.14),
  box("MD", 37.9, -79.5, 39.73, -75.04),
  box("MA", 41.23, -73.51, 42.89, -69.9),
  box("CT", 40.95, -73.75, 42.06, -71.78),
  box("DC", 38.79, -77.12, 39.0, -76.9),
  box("DE", 38.45, -75.8, 39.85, -75.04),
  box("RI", 41.14, -71.87, 42.02, -71.12),
  box("NH", 42.7, -72.56, 45.31, -70.7),
  box("VT", 42.72, -73.44, 45.02, -71.46),
  box("ME", 43.05, -71.1, 47.47, -66.9),
  box("WV", 37.2, -82.65, 40.64, -77.72),
  box("NE", 39.99, -104.06, 43.01, -95.3),
  box("SD", 42.48, -104.06, 45.95, -96.43),
  box("ND", 45.93, -104.06, 49.01, -96.55),
  box("MT", 44.35, -116.06, 49.01, -104.03),
  box("WY", 40.99, -111.06, 45.01, -104.05),
  box("ID", 41.99, -117.25, 49.01, -111.04),
  box("AK", 51.2, -170.0, 71.5, -129.9),
  box("HI", 18.9, -160.3, 22.25, -154.8),
  box("PR", 17.88, -67.28, 18.52, -65.22),
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let cameras = [];
let complete = false;
let partial = false;
let buildPromise = null;
let retryAfter = 0;
const progress = { done: 0, total: REGIONS.length, error: null };

function fresh(cachedAt, ttl) {
  return cachedAt && Date.now() - cachedAt < ttl;
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value));
  await fs.rename(tmp, file);
}

function buildQuery(region) {
  const bbox = [region.south, region.west, region.north, region.east].map((n) => n.toFixed(4)).join(",");
  return `[out:csv(::type,::id,::lat,::lon,manufacturer,operator,surveillance,"surveillance:zone",direction,"camera:mount",name;true;"\t")][timeout:60];
(
  node["surveillance:type"~"^(ALPR|ANPR)$",i](${bbox});
  way["surveillance:type"~"^(ALPR|ANPR)$",i](${bbox});
);
out center;`;
}

async function overpass(query) {
  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const { data, status } = await axios.post(
        endpoint,
        new URLSearchParams({ data: query }).toString(),
        {
          timeout: 75000,
          responseType: "text",
          maxContentLength: 40 * 1024 * 1024,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT,
            Accept: "text/plain,*/*",
          },
          validateStatus: () => true,
        }
      );
      const body = typeof data === "string" ? data : "";
      if (status >= 200 && status < 300 && body.startsWith("@type")) return body;
      lastError = new Error(
        `Overpass ${new URL(endpoint).host} HTTP ${status}: ${body.replace(/\s+/g, " ").slice(0, 160)}`
      );
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("Overpass request failed");
}

export function parseOverpassCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (!lines.length || !lines[0].startsWith("@type")) {
    throw new Error("Overpass did not return a camera table");
  }
  const header = lines[0].split("\t");
  const idx = Object.fromEntries(header.map((name, i) => [name, i]));
  const camerasOut = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const type = cols[idx["@type"]];
    const id = cols[idx["@id"]];
    const lat = Number(cols[idx["@lat"]]);
    const lon = Number(cols[idx["@lon"]]);
    if ((type !== "node" && type !== "way") || !/^\d+$/.test(id ?? "")) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    const manufacturer = blank(cols[idx.manufacturer]);
    const operator = blank(cols[idx.operator]);
    const name = blank(cols[idx.name]);
    camerasOut.push({
      id: `${type}/${id}`,
      lat,
      lon,
      manufacturer,
      operator,
      surveillance: blank(cols[idx.surveillance]),
      zone: blank(cols[idx["surveillance:zone"]]),
      direction: blank(cols[idx.direction]),
      mount: blank(cols[idx["camera:mount"]]),
      name,
      flock: /flock/i.test(`${manufacturer ?? ""} ${operator ?? ""} ${name ?? ""}`),
    });
  }
  return camerasOut;
}

function blank(value) {
  const text = (value ?? "").trim();
  return text ? text : null;
}

function shouldSplit(err) {
  const msg = String(err?.message || err).toLowerCase();
  return /timeout|timed out|504|502|429|busy|capacity|runtime error/.test(msg);
}

function splitRegion(region) {
  const midLat = (region.south + region.north) / 2;
  const midLon = (region.west + region.east) / 2;
  const taller = region.north - region.south >= region.east - region.west;
  if (taller) {
    return [
      { ...region, name: `${region.name}a`, north: midLat },
      { ...region, name: `${region.name}b`, south: midLat },
    ];
  }
  return [
    { ...region, name: `${region.name}a`, east: midLon },
    { ...region, name: `${region.name}b`, west: midLon },
  ];
}

async function fetchRegion(region, depth) {
  try {
    return parseOverpassCsv(await overpass(buildQuery(region)));
  } catch (err) {
    if (depth >= 2 || !shouldSplit(err)) throw err;
    console.warn(`[alpr] ${region.name} split (${String(err.message).slice(0, 120)})`);
    const camerasOut = [];
    for (const half of splitRegion(region)) {
      await sleep(500);
      camerasOut.push(...(await fetchRegion(half, depth + 1)));
    }
    return camerasOut;
  }
}

async function readRegion(name) {
  const saved = await readJson(path.join(REGION_DIR, `${name}.json`));
  if (!saved || !Array.isArray(saved.cameras) || !fresh(saved.cachedAt, REGION_TTL_MS)) return null;
  return saved.cameras;
}

function publish(list) {
  cameras = list;
}

async function buildDataset() {
  try {
    const saved = await readJson(DATASET_FILE);
    if (saved?.complete && Array.isArray(saved.cameras) && fresh(saved.cachedAt, saved.partial ? 30 * 60 * 1000 : CACHE_TTL_MS)) {
      publish(saved.cameras);
      complete = true;
      partial = Boolean(saved.partial);
      progress.done = REGIONS.length;
      progress.error = null;
      console.log(`[alpr] using cached set (${saved.cameras.length} cameras)`);
      return;
    }

    const byId = new Map();
    partial = false;
    console.log(`[alpr] loading ALPR cameras across the US (${REGIONS.length} areas)`);

    for (const region of REGIONS) {
      try {
        let list = await readRegion(region.name);
        if (!list) {
          list = await fetchRegion(region, 0);
          await writeJson(path.join(REGION_DIR, `${region.name}.json`), {
            cachedAt: Date.now(),
            cameras: list,
          });
          await sleep(700);
        }
        for (const camera of list) byId.set(camera.id, camera);
        console.log(`[alpr] ${region.name}: ${list.length} cameras`);
      } catch (err) {
        partial = true;
        console.warn(`[alpr] ${region.name} skipped: ${String(err?.message || err).slice(0, 180)}`);
      }
      progress.done += 1;
      if (byId.size > 0) publish([...byId.values()]);
    }

    if (byId.size === 0) {
      progress.error = "OpenStreetMap is not responding right now";
      retryAfter = Date.now() + 60 * 1000;
      console.error("[alpr] no cameras loaded");
      return;
    }

    complete = true;
    progress.error = null;
    publish([...byId.values()]);
    await writeJson(DATASET_FILE, {
      cachedAt: Date.now(),
      complete: true,
      partial,
      cameras,
    });
    console.log(`[alpr] ready: ${cameras.length} cameras${partial ? " (some areas missing)" : ""}`);
  } catch (err) {
    progress.error = "OpenStreetMap is not responding right now";
    retryAfter = Date.now() + 60 * 1000;
    console.error("[alpr] build failed:", err?.message || err);
  }
}

function startBuild() {
  if (complete && cameras.length > 0) return;
  if (buildPromise) return;
  if (Date.now() < retryAfter && cameras.length === 0) return;
  progress.done = 0;
  progress.total = REGIONS.length;
  progress.error = null;
  buildPromise = buildDataset().finally(() => {
    buildPromise = null;
  });
}

function groupCameras(list, cell) {
  const groups = new Map();
  for (const camera of list) {
    const key = `${Math.floor(camera.lat / cell)}:${Math.floor(camera.lon / cell)}`;
    let group = groups.get(key);
    if (!group) {
      group = { lat: 0, lon: 0, count: 0, flock: 0, only: null };
      groups.set(key, group);
    }
    group.lat += camera.lat;
    group.lon += camera.lon;
    group.count += 1;
    if (camera.flock) group.flock += 1;
    group.only = group.count === 1 ? camera : null;
  }

  const features = [];
  for (const group of groups.values()) {
    if (group.count === 1 && group.only) {
      features.push({ kind: "camera", ...group.only });
    } else {
      features.push({
        kind: "cluster",
        lat: group.lat / group.count,
        lon: group.lon / group.count,
        count: group.count,
        flock: group.flock,
      });
    }
  }
  return features;
}

/** Collapse a view full of cameras into individual points or count bubbles. */
export function clusterCameras(list, zoom) {
  const z = Number.isFinite(zoom) ? zoom : 4;
  // Low zooms cover whole states in a few pixels, so the cells stay large enough
  // that the count bubbles do not pile on top of each other.
  let cell = 0.00028;
  if (z <= 4) cell = 6;
  else if (z <= 6) cell = 2.2;
  else if (z <= 8) cell = 0.65;
  else if (z <= 11) cell = 0.08;
  else if (z <= 14) cell = 0.012;
  let features = groupCameras(list, cell);
  let guard = 0;
  while (features.length > 650 && cell < 8 && guard < 6) {
    cell *= 1.7;
    features = groupCameras(list, cell);
    guard += 1;
  }
  return features;
}

export async function camerasForView(bounds) {
  startBuild();
  if (buildPromise && cameras.length === 0) {
    await Promise.race([buildPromise, sleep(1200)]);
  }

  const matched = [];
  let flockInView = 0;
  for (const camera of cameras) {
    if (camera.lat < bounds.south || camera.lat > bounds.north) continue;
    if (camera.lon < bounds.west || camera.lon > bounds.east) continue;
    if (bounds.flockOnly && !camera.flock) continue;
    matched.push(camera);
    if (camera.flock) flockInView += 1;
  }

  const status = complete
    ? "ready"
    : progress.error && cameras.length === 0
      ? "error"
      : "loading";

  return {
    status,
    source: "OpenStreetMap",
    partial,
    error: status === "error" ? progress.error : null,
    regionsDone: progress.done,
    regionsTotal: progress.total,
    totalInView: matched.length,
    flockInView,
    features: clusterCameras(matched, bounds.zoom),
  };
}
