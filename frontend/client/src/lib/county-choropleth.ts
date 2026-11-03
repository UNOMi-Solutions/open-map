import { useEffect, useState } from "react";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { HEALTH_CHOROPLETH_COLORS_NEGATIVE } from "@/lib/health-places";

export type County = { name: string };
export type CountyFeature = Feature<Polygon | MultiPolygon, County>;

export const STATE_FIPS_TO_ABBREV: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT",
  "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL",
  "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
  "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE",
  "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV",
  "55": "WI", "56": "WY", "72": "PR",
};

/** Matches the health choropleth styling so county layers look consistent. */
export const COUNTY_CHOROPLETH_STYLE = {
  fillOpacity: 0.68,
  color: "#0a3b55",
  weight: 0.35,
  opacity: 0.45,
} as const;

/**
 * Sequential palettes for county event counts. Index 0 (white) is counties with a
 * count of zero. Heat, high wind, and generic risk stay on the health reds;
 * water / ice / storm layers use a color that reads as the hazard.
 */
export const COUNT_PALETTES = {
  red: HEALTH_CHOROPLETH_COLORS_NEGATIVE,
  thunderstorm: ["#ffffff", "#fef3c7", "#fde047", "#facc15", "#eab308", "#ca8a04", "#854d0e"],
  hail: ["#ffffff", "#ccfbf1", "#5eead4", "#2dd4bf", "#0d9488", "#0f766e", "#134e4a"],
  flood: ["#ffffff", "#dbeafe", "#93c5fd", "#3b82f6", "#2563eb", "#1d4ed8", "#1e3a8a"],
  hurricane: ["#ffffff", "#ede9fe", "#c4b5fd", "#a78bfa", "#7c3aed", "#6d28d9", "#4c1d95"],
  winter: ["#ffffff", "#e0e7ff", "#a5b4fc", "#818cf8", "#6366f1", "#4338ca", "#1e1b4b"],
  cold: ["#ffffff", "#cffafe", "#67e8f9", "#22d3ee", "#0891b2", "#0e7490", "#155e75"],
} as const;

export type CountPalette = readonly string[];

const DEFAULT_PALETTE: CountPalette = COUNT_PALETTES.red;
const BIN_COUNT = DEFAULT_PALETTE.length - 1;

function binsOf(palette: CountPalette): readonly string[] {
  return palette.slice(1);
}

// Quantile upper bounds over the non-zero counts, deduped because low integer counts repeat heavily
export function quantileBreaks(counts: number[]): number[] {
  const sorted = counts.filter((c) => c > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const breaks: number[] = [];
  for (let i = 1; i <= BIN_COUNT; i++) {
    const idx = Math.min(sorted.length - 1, Math.floor((i / BIN_COUNT) * sorted.length) - 1);
    const value = sorted[Math.max(0, idx)];
    if (breaks[breaks.length - 1] !== value) breaks.push(value);
  }
  return breaks;
}

// Spread the available bins across the palette so the highest bin is always the darkest stop
function binColor(binIndex: number, binCount: number, palette: CountPalette): string {
  const bins = binsOf(palette);
  if (binCount <= 1) return bins[bins.length - 1];
  return bins[Math.round((binIndex * (bins.length - 1)) / (binCount - 1))];
}

export function countColor(
  count: number,
  breaks: number[],
  palette: CountPalette = DEFAULT_PALETTE,
): string {
  if (count <= 0 || breaks.length === 0) return palette[0];
  for (let i = 0; i < breaks.length; i++) {
    if (count <= breaks[i]) return binColor(i, breaks.length, palette);
  }
  return binColor(breaks.length - 1, breaks.length, palette);
}

/** US Drought Monitor-style yellow → red bins for 0–100% county coverage. */
const PERCENT_COLORS = ["#ffffff", "#ffff00", "#fcd37f", "#ffaa00", "#e60000", "#730000"];
const PERCENT_BREAKS = [0, 20, 40, 60, 80, 100];

export function percentColor(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return PERCENT_COLORS[0];
  if (pct < 20) return PERCENT_COLORS[1];
  if (pct < 40) return PERCENT_COLORS[2];
  if (pct < 60) return PERCENT_COLORS[3];
  if (pct < 80) return PERCENT_COLORS[4];
  return PERCENT_COLORS[5];
}

export function percentLegendHtml(title: string): string {
  const stops = PERCENT_COLORS
    .map((color, i) => `${color} ${PERCENT_COLORS.length > 1 ? (i / (PERCENT_COLORS.length - 1)) * 100 : 0}%`)
    .join(", ");
  return (
    `<h4>${title}</h4>` +
    `<div class="gradient-legend-bar" style="background:linear-gradient(to right, ${stops})"></div>` +
    `<div class="gradient-legend-labels">${PERCENT_BREAKS.map((n) => `<span>${n}%</span>`).join("")}</div>`
  );
}

/** Inner HTML for a sequential gradient legend with one label per bin. */
export function countLegendHtml(
  title: string,
  breaks: number[],
  palette: CountPalette = DEFAULT_PALETTE,
): string {
  const colors = [palette[0], ...breaks.map((_, i) => binColor(i, breaks.length, palette))];
  const stops = colors
    .map((color, i) => `${color} ${colors.length > 1 ? (i / (colors.length - 1)) * 100 : 0}%`)
    .join(", ");
  const labels = ["0", ...breaks.map((upper, i) => {
    const lower = i === 0 ? 1 : breaks[i - 1] + 1;
    return lower >= upper ? String(upper) : `${lower}–${upper}`;
  })];
  return (
    `<h4>${title}</h4>` +
    `<div class="gradient-legend-bar" style="background:linear-gradient(to right, ${stops})"></div>` +
    `<div class="gradient-legend-labels">${labels.map((l) => `<span>${l}</span>`).join("")}</div>`
  );
}

/** US county polygons (feature id is the 5-digit county FIPS). */
export function useCountyFeatures(): CountyFeature[] {
  const [features, setFeatures] = useState<CountyFeature[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/geo/counties-10m.json")
      .then((response) => response.json())
      .then((topo: Topology) => {
        const collection = feature(
          topo,
          topo.objects.counties as GeometryCollection<County>,
        ) as FeatureCollection<Polygon | MultiPolygon, County>;
        if (!cancelled) setFeatures(collection.features as CountyFeature[]);
      })
      .catch((err) => console.error("Failed to load counties:", err));
    return () => {
      cancelled = true;
    };
  }, []);
  return features;
}
