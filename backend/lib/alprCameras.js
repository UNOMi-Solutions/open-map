// License-plate readers from OpenStreetMap, via the public Overpass API.
// Cameras are tagged surveillance:type=ALPR (ANPR is the British name for the same thing).
// A nationwide query times out, so the country is loaded one area at a time and cached.
// A saved copy is drawn immediately. With nothing saved, the first map view is downloaded
// before the rest of the country, instead of always starting in Georgia.
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const USER_AGENT = "OpenMap/1.0";
const OVERPASS_ENDPOINTS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REGION_TTL_MS = 24 * 60 * 60 * 1000;
const PARTIAL_TTL_MS = 30 * 60 * 1000;
// The public Overpass instances allow two queries at a time.
const LANES = 2;
const REGION_PAUSE_MS = 400;
const VIEW_WAIT_MS = 8000;

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(LIB_DIR, "..", "cache", "alpr");
const REGION_DIR = path.join(CACHE_DIR, "regions");
const DATASET_FILE = path.join(CACHE_DIR, "dataset.json");
const SEED_FILE = path.join(LIB_DIR, "..", "data", "alpr-seed.json");
const SEED_GZ = path.join(LIB_DIR, "..", "data", "alpr-seed.json.gz");

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

let byId = new Map();
let cameras = [];
let grid = new Map();
let servingComplete = false;
let needsRefresh = false;
let partial = false;
let buildPromise = null;
let retryAfter = 0;
let queueReady = false;
let active = 0;
let refreshFailed = false;
let hotBounds = null;
let hotKey = "";
const progress = { done: 0, total: REGIONS.length, error: null };
const finished = new Set();
const jobs = new Set();
const listeners = new Set();
let queue = [];
let memoryPromise = null;
let viewWaiters = 0;
let hurryResolvers = [];

function fresh(cachedAt, ttl) {
  return cachedAt && Date.now() - cachedAt < ttl;
}

function intersects(region, bounds) {
  return region.south <= bounds.north && region.north >= bounds.south
    && region.west <= bounds.east && region.east >= bounds.west;
}

function contains(region, camera) {
  return camera.lat >= region.south && camera.lat <= region.north
    && camera.lon >= region.west && camera.lon <= region.east;
}

function notify() {
  for (const fn of [...listeners]) fn();
}

function waitFor(predicate, ms) {
  if (predicate()) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => finish(), ms);
    function check() {
      if (predicate()) finish();
    }
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      listeners.delete(check);
      resolve();
    }
    listeners.add(check);
  });
}

function waitForQueue(ms) {
  if (queue.length > 0) return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => finish(false), ms);
    function check() {
      if (queue.length > 0) finish(true);
      else if (active === 0) finish(false);
    }
    function finish(value) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      listeners.delete(check);
      resolve(value);
    }
    listeners.add(check);
  });
}

function pause(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(finish, ms);
    function finish() {
      clearTimeout(timer);
      hurryResolvers = hurryResolvers.filter((fn) => fn !== finish);
      resolve();
    }
    hurryResolvers.push(finish);
  });
}

function requestHurry() {
  const pending = hurryResolvers;
  hurryResolvers = [];
  for (const fn of pending) fn();
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

function isAbort(err) {
  return err?.code === "ERR_CANCELED" || err?.name === "AbortError" || err?.name === "CanceledError";
}

function abortError() {
  const err = new Error("aborted");
  err.code = "ERR_CANCELED";
  err.name = "AbortError";
  return err;
}

async function overpass(query, signal) {
  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    if (signal?.aborted) throw abortError();
    try {
      const { data, status } = await axios.post(
        endpoint,
        new URLSearchParams({ data: query }).toString(),
        {
          timeout: 75000,
          signal,
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
      if (isAbort(err) || signal?.aborted) throw abortError();
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

async function fetchRegion(region, depth, signal) {
  try {
    return parseOverpassCsv(await overpass(buildQuery(region), signal));
  } catch (err) {
    if (isAbort(err) || signal?.aborted) throw abortError();
    if (depth >= 2 || !shouldSplit(err)) throw err;
    console.warn(`[alpr] ${region.name} split (${String(err.message).slice(0, 120)})`);
    const camerasOut = [];
    for (const half of splitRegion(region)) {
      if (signal?.aborted) throw abortError();
      await sleep(400);
      if (signal?.aborted) throw abortError();
      camerasOut.push(...(await fetchRegion(half, depth + 1, signal)));
    }
    return camerasOut;
  }
}

async function readRegionFile(name) {
  const saved = await readJson(path.join(REGION_DIR, `${name}.json`));
  if (!saved || !Array.isArray(saved.cameras)) return null;
  return { cameras: saved.cameras, fresh: fresh(saved.cachedAt, REGION_TTL_MS) };
}

function publishFromMap() {
  cameras = [...byId.values()];
  const next = new Map();
  for (const camera of cameras) {
    const key = `${Math.floor(camera.lat)}:${Math.floor(camera.lon)}`;
    let bucket = next.get(key);
    if (!bucket) {
      bucket = [];
      next.set(key, bucket);
    }
    bucket.push(camera);
  }
  grid = next;
}

function applyList(list) {
  byId = new Map();
  for (const camera of list) {
    if (!camera || !Number.isFinite(camera.lat) || !Number.isFinite(camera.lon)) continue;
    byId.set(camera.id, camera);
  }
  publishFromMap();
}

function mergeRegion(region, list, publishNow = true) {
  for (const [id, camera] of byId) {
    if (contains(region, camera)) byId.delete(id);
  }
  for (const camera of list) byId.set(camera.id, camera);
  if (publishNow) publishFromMap();
}

async function persistDataset() {
  try {
    await writeJson(DATASET_FILE, {
      cachedAt: Date.now(),
      complete: true,
      partial,
      cameras,
    });
  } catch (err) {
    console.warn(`[alpr] could not save cache: ${err?.message || err}`);
  }
}

function applySnapshot(saved, label) {
  applyList(saved.cameras);
  partial = Boolean(saved.partial);
  const ttl = saved.partial ? PARTIAL_TTL_MS : CACHE_TTL_MS;
  const isFresh = fresh(saved.cachedAt, ttl);
  const isComplete = Boolean(saved.complete);
  servingComplete = isComplete && cameras.length > 0;
  needsRefresh = !(isFresh && isComplete);
  progress.done = servingComplete ? REGIONS.length : finished.size;
  progress.total = REGIONS.length;
  progress.error = null;
  const note = needsRefresh ? ", refreshing in the background" : "";
  console.log(`[alpr] serving ${label} set (${cameras.length} cameras${note})`);
  return { fresh: isFresh, complete: isComplete };
}

async function readBundledSeed() {
  const json = await readJson(SEED_FILE);
  if (Array.isArray(json?.cameras) && json.cameras.length > 0) return json;
  try {
    const gz = await fs.readFile(SEED_GZ);
    const parsed = JSON.parse(zlib.gunzipSync(gz).toString("utf8"));
    if (Array.isArray(parsed?.cameras) && parsed.cameras.length > 0) return parsed;
  } catch {
    return null;
  }
  return null;
}

async function hydrate() {
  progress.total = REGIONS.length;
  const cached = await readJson(DATASET_FILE);
  const snapshot = Array.isArray(cached?.cameras) && cached.cameras.length > 0
    ? { saved: cached, label: "saved" }
    : null;
  const bundled = snapshot ? null : await readBundledSeed();
  const chosen = snapshot ?? (bundled ? { saved: bundled, label: "bundled" } : null);
  if (chosen) {
    const usable = applySnapshot(chosen.saved, chosen.label);
    if (usable.fresh && usable.complete) return;
  }

  const hadSnapshot = byId.size > 0;
  for (const region of REGIONS) {
    const saved = await readRegionFile(region.name);
    if (!saved) continue;
    if (saved.fresh) {
      mergeRegion(region, saved.cameras, false);
      finished.add(region.name);
    } else if (!hadSnapshot) {
      mergeRegion(region, saved.cameras, false);
    }
  }
  if (byId.size > 0) publishFromMap();

  if (finished.size === REGIONS.length && byId.size > 0) {
    servingComplete = true;
    needsRefresh = false;
    partial = false;
    progress.done = REGIONS.length;
    progress.error = null;
    console.log(`[alpr] assembled ${cameras.length} cameras from area cache`);
    await persistDataset();
    return;
  }

  needsRefresh = finished.size < REGIONS.length || !servingComplete || needsRefresh;
  progress.done = servingComplete ? REGIONS.length : finished.size;
}

function ensureMemory() {
  if (!memoryPromise) {
    memoryPromise = hydrate().catch((err) => {
      memoryPromise = null;
      throw err;
    });
  }
  return memoryPromise;
}

function ensureQueue() {
  if (queueReady) return;
  queue = REGIONS.filter((region) => !finished.has(region.name));
  queueReady = true;
}

function prioritize(bounds) {
  hotBounds = bounds;
  if (!queue.length && jobs.size === 0) return;
  const front = [];
  const back = [];
  for (const region of queue) {
    (intersects(region, bounds) ? front : back).push(region);
  }
  queue = front.concat(back);
  const key = front.map((region) => region.name).join(",");
  if (key === hotKey) return;
  hotKey = key;
  if (!key) return;
  for (const job of jobs) {
    if (!intersects(job.region, bounds)) job.controller.abort();
  }
  requestHurry();
}

function viewSettled(bounds) {
  const regions = REGIONS.filter((region) => intersects(region, bounds));
  if (!regions.length) return true;
  return regions.every((region) => finished.has(region.name));
}

async function maybePause() {
  const next = queue[0];
  if (!next) return;
  if (hotBounds && intersects(next, hotBounds)) return;
  await pause(REGION_PAUSE_MS);
}

async function processRegion(region) {
  const controller = new AbortController();
  const job = { region, controller };
  jobs.add(job);
  let pauseAfter = false;
  try {
    const saved = await readRegionFile(region.name);
    let list;
    if (saved?.fresh) {
      list = saved.cameras;
    } else {
      list = await fetchRegion(region, 0, controller.signal);
      await writeJson(path.join(REGION_DIR, `${region.name}.json`), {
        cachedAt: Date.now(),
        cameras: list,
      });
      pauseAfter = true;
    }
    mergeRegion(region, list);
    finished.add(region.name);
    progress.done = finished.size;
    progress.error = null;
    console.log(`[alpr] ${region.name}: ${list.length} cameras${saved?.fresh ? " (cached)" : ""}`);
  } catch (err) {
    if (isAbort(err) || controller.signal.aborted) {
      queue.push(region);
      return;
    }
    refreshFailed = true;
    partial = true;
    finished.add(region.name);
    progress.done = finished.size;
    console.warn(`[alpr] ${region.name} skipped: ${String(err?.message || err).slice(0, 180)}`);
  } finally {
    jobs.delete(job);
  }
  if (pauseAfter && finished.has(region.name)) await maybePause();
}

async function lane() {
  for (;;) {
    const region = queue.shift();
    if (!region) {
      if (active === 0) return;
      const arrived = await waitForQueue(1500);
      if (!arrived && active === 0 && queue.length === 0) return;
      continue;
    }
    active += 1;
    try {
      await processRegion(region);
    } finally {
      active -= 1;
      notify();
    }
  }
}

async function worker() {
  refreshFailed = false;
  try {
    do {
      const lanes = [];
      for (let i = 0; i < LANES; i++) lanes.push(lane());
      await Promise.all(lanes);
    } while (queue.length > 0);

    if (byId.size === 0) {
      progress.error = "OpenStreetMap is not responding right now";
      retryAfter = Date.now() + 60 * 1000;
      finished.clear();
      queueReady = false;
      queue = [];
      hotKey = "";
      console.error("[alpr] no cameras loaded");
      return;
    }

    partial = refreshFailed;
    servingComplete = true;
    needsRefresh = false;
    progress.error = null;
    progress.done = REGIONS.length;
    console.log(`[alpr] ready: ${cameras.length} cameras${partial ? " (some areas missing)" : ""}`);
    await persistDataset();
  } catch (err) {
    progress.error = "OpenStreetMap is not responding right now";
    retryAfter = Date.now() + 60 * 1000;
    if (cameras.length === 0) {
      finished.clear();
      queueReady = false;
      queue = [];
    }
    console.error("[alpr] build failed:", err?.message || err);
  } finally {
    notify();
  }
}

function startBuild() {
  if (buildPromise) return buildPromise;
  if (servingComplete && !needsRefresh) return null;
  if (Date.now() < retryAfter && cameras.length === 0) return null;
  ensureQueue();
  if (queue.length === 0) {
    if (byId.size > 0) {
      servingComplete = true;
      needsRefresh = false;
      partial = false;
      progress.done = REGIONS.length;
      progress.error = null;
      void persistDataset();
    }
    return null;
  }
  progress.total = REGIONS.length;
  progress.done = finished.size;
  console.log(`[alpr] loading ${queue.length} areas`);
  buildPromise = worker().finally(() => {
    buildPromise = null;
  });
  return buildPromise;
}

/** Loads a saved copy into memory, then refreshes it in the background when it is stale. */
export async function warmAlprCache() {
  await ensureMemory();
  // Nothing saved yet: wait for the first map view so that area is fetched first.
  if (servingComplete && needsRefresh) startBuild();
}

/** Fetches any missing areas and resolves when the set in memory is ready to draw. */
export async function refreshAlprCache() {
  await ensureMemory();
  if (!(servingComplete && !needsRefresh && cameras.length > 0)) {
    const pending = startBuild();
    if (pending) await pending;
  }
  if (cameras.length === 0) {
    throw new Error(progress.error || "ALPR refresh did not finish");
  }
  return cameras.length;
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

function collect(bounds) {
  if (cameras.length === 0) return [];
  const lat0 = Math.floor(bounds.south);
  const lat1 = Math.floor(bounds.north);
  const lon0 = Math.floor(bounds.west);
  const lon1 = Math.floor(bounds.east);
  const matched = [];
  for (let lat = lat0; lat <= lat1; lat++) {
    for (let lon = lon0; lon <= lon1; lon++) {
      const bucket = grid.get(`${lat}:${lon}`);
      if (!bucket) continue;
      for (const camera of bucket) {
        if (camera.lat < bounds.south || camera.lat > bounds.north) continue;
        if (camera.lon < bounds.west || camera.lon > bounds.east) continue;
        if (bounds.flockOnly && !camera.flock) continue;
        matched.push(camera);
      }
    }
  }
  return matched;
}

function responseStatus(bounds) {
  if (cameras.length === 0 && progress.error && !buildPromise) return "error";
  if (servingComplete || viewSettled(bounds)) return "ready";
  return "loading";
}

function buildResponse(bounds) {
  const matched = collect(bounds);
  let flockInView = 0;
  for (const camera of matched) if (camera.flock) flockInView += 1;
  const status = responseStatus(bounds);
  return {
    status,
    source: "OpenStreetMap",
    partial,
    error: status === "error" ? progress.error : null,
    regionsDone: servingComplete ? REGIONS.length : finished.size,
    regionsTotal: REGIONS.length,
    totalInView: matched.length,
    flockInView,
    features: clusterCameras(matched, bounds.zoom),
  };
}

export async function camerasForView(bounds) {
  await ensureMemory();
  if (!servingComplete) {
    ensureQueue();
    prioritize(bounds);
    startBuild();
    if (buildPromise && !viewSettled(bounds) && collect(bounds).length === 0 && viewWaiters === 0) {
      viewWaiters += 1;
      try {
        await waitFor(() => viewSettled(bounds) || !buildPromise, VIEW_WAIT_MS);
      } finally {
        viewWaiters -= 1;
      }
    }
  } else if (needsRefresh) {
    startBuild();
  }
  return buildResponse(bounds);
}
