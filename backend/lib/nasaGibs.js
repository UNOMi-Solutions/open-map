// NASA GIBS (Global Imagery Browse Services) layer facts, read from the WMTS capabilities document.
// The frontend keeps the curated list of layers (frontend/client/src/lib/nasaLayers.ts); 
// this module generates layer requests
// tile URL template, native zoom, the dates that exist, and the legend image.
// Nothing is typed by hand, so a layer NASA renames or retires
// simply drops out of the response instead of rendering blank tiles.
import axios from "axios";
import { getCached } from "../utils/dataCache.js";

const CAPABILITIES_URL =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml";
const CAPABILITIES_TTL_MS = 6 * 60 * 60 * 1000; // GIBS adds a day of data roughly daily
const ID_PATTERN = /^[A-Za-z0-9_.-]+$/;

const first = (re, text) => (text ? (re.exec(text) || [])[1] ?? null : null);

/** "2000-02-24/2026-11-14/P1D" -> { start, end, interval }; a lone date is a single-value range. */
function parseRanges(dimension) {
  const ranges = [];
  for (const [, value] of dimension.matchAll(/<Value>([^<]+)<\/Value>/g)) {
    for (const part of value.split(",")) {
      const bits = part.trim().split("/");
      if (bits.length === 3) ranges.push({ start: bits[0], end: bits[1], interval: bits[2] });
      else if (bits.length === 1 && bits[0]) ranges.push({ start: bits[0], end: bits[0], interval: null });
    }
  }
  return ranges;
}

/** One <Layer> block -> returns facts the map needs. Returns null for anything Leaflet cannot draw */
function parseLayer(block) {
  const gibsId = first(/<ows:Identifier>([^<]+)<\/ows:Identifier>/, block);
  const format = first(/<Format>([^<]+)<\/Format>/, block) || "";
  const tms = first(/<TileMatrixSet>([^<]+)<\/TileMatrixSet>/, block) || "";
  const level = first(/GoogleMapsCompatible_Level(\d+)/, tms);
  // Vector tiles (fire points, flight tracks) and non-Google grids are not raster map tiles.
  if (!gibsId || !level || !/^image\/(png|jpeg)$/.test(format)) return null;

  const dimension = first(/(<Dimension>[\s\S]*?<\/Dimension>)/, block);
  const hasTime = !!dimension && dimension.includes("<ows:Identifier>Time</ows:Identifier>");
  const ext = format === "image/jpeg" ? "jpg" : "png";

  // Prefer NASA's own ResourceURL; fall back to the documented REST pattern.
  const resource = [...block.matchAll(/<ResourceURL[^>]*>/g)]
    .map(([tag]) => tag)
    .find((tag) => /resourceType=["']tile["']/.test(tag));
  const template = (
    first(/template=["']([^"']+)["']/, resource) ||
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${gibsId}/default/${hasTime ? "{Time}/" : ""}{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.${ext}`
  )
    .replace("{TileMatrixSet}", tms)
    .replace("{TileMatrix}", "{z}")
    .replace("{TileRow}", "{y}")
    .replace("{TileCol}", "{x}")
    .replace("{Time}", "{time}");

  const legendTags = [...block.matchAll(/<LegendURL[^>]*>/g)].map(([tag]) => tag);
  const legendTag = legendTags.find((tag) => /legend-type\/horizontal/.test(tag)) || legendTags[0];

  return {
    gibsId,
    template,
    format,
    maxNativeZoom: Number(level),
    hasTime,
    defaultTime: hasTime ? first(/<Default>([^<]+)<\/Default>/, dimension) : null,
    ranges: hasTime ? parseRanges(dimension) : [],
    legendUrl: first(/xlink:href=["']([^"']+)["']/, legendTag),
  };
}

/** Exported for the unit test. */
export function parseCapabilities(xml) {
  const layers = new Map();
  for (const [block] of xml.matchAll(/<Layer[\s>][\s\S]*?<\/Layer>/g)) {
    const layer = parseLayer(block);
    if (layer) layers.set(layer.gibsId, layer);
  }
  return layers;
}

async function loadCapabilities() {
  const { data } = await axios.get(CAPABILITIES_URL, {
    responseType: "text",
    timeout: 60_000,
    maxContentLength: 100 * 1024 * 1024,
  });
  const layers = parseCapabilities(String(data));
  if (!layers.size) throw new Error("GIBS capabilities parsed to zero layers");
  return { fetchedAt: new Date().toISOString(), layers };
}

/**
 * Facts for the requested GIBS identifiers. Unknown identifiers are listed in `missing` so the
 * frontend can hide them instead of drawing an empty layer.
 */
export async function getNasaLayers(ids) {
  const wanted = [...new Set(ids)].filter((id) => ID_PATTERN.test(id)).slice(0, 200);
  const { fetchedAt, layers } = await getCached(
    "environment:nasaGibsCapabilities:v1",
    CAPABILITIES_TTL_MS,
    loadCapabilities,
  );
  const found = {};
  const missing = [];
  for (const id of wanted) {
    const layer = layers.get(id);
    if (layer) found[id] = layer;
    else missing.push(id);
  }
  if (missing.length) console.warn("[nasaGibs] not in GIBS capabilities:", missing.join(", "));
  return {
    fetchedAt,
    attribution: "NASA EOSDIS Global Imagery Browse Services (GIBS)",
    sourceUrl: "https://nasa-gibs.github.io/gibs-api-docs/",
    layers: found,
    missing,
  };
}
