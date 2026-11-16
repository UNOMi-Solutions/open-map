import { groupLocationSites } from "./datapoint-map-style";

export type RiskKind = "fracking" | "runoff" | "drinkingWater";
export interface RiskRecord {
  id: string;
  name: string;
  state: string;
  sourceUrl: string;
  details: [string, string][];
}
export interface RiskPoint extends RiskRecord { latitude: number; longitude: number }
export interface WaterSystem extends RiskRecord { fips: string[]; flagged: boolean | null }
export interface WaterCounty { fips: string; total: number; flagged: number; unknown: number; systemIds: string[] }
export interface RiskResponse {
  sourceUrl: string;
  retrievedAt: string;
  year?: number;
  excluded: number;
  points?: RiskPoint[];
  systems?: WaterSystem[];
  counties?: WaterCounty[];
  unmappedSystems?: number;
  totalSystems?: number;
}

export const RISK_META: Record<RiskKind, { title: string; endpoint: string; color: string; source: string; note: string }> = {
  fracking: {
    title: "Fracking Locations", endpoint: "frackingLocations", color: "#b45309", source: "https://www.fracfocus.org/wells",
    note: "Wells with reported jobs completed in the selected year. Operator-submitted disclosures; partial coverage. A marker does not indicate current activity.",
  },
  runoff: {
    title: "Industrial Runoff", endpoint: "industrialRunoff", color: "#7c3aed", source: "https://www.epa.gov/toxics-release-inventory-tri-program/tri-basic-data-files-calendar-years-1987-present",
    note: "Reported surface-water releases, including process discharges. Totals do not isolate stormwater runoff or measure contamination at the marker. Reporting facilities only.",
  },
  drinkingWater: {
    title: "Toxic Water Supply", endpoint: "drinkingWater", color: "#dc2626", source: "https://echo.epa.gov/tools/web-services/facility-search-drinking-water",
    note: "Counties served by systems with EPA health-based violation flags, including contaminant limits and treatment requirements. Shading does not establish household water safety. Reporting-only violations are excluded.",
  },
};

// Same count scale as other Environment layers, with coincident records selectable together.
export function groupRiskPoints(points: RiskPoint[], zoom: number, project: (lat: number, lon: number) => { x: number; y: number }): Array<[string, RiskPoint[]]> {
  if (zoom < 14) return groupLocationSites(points, zoom, project);
  const groups = new Map<string, RiskPoint[]>();
  for (const point of points) {
    const key = `${point.latitude}:${point.longitude}`;
    const group = groups.get(key);
    if (group) group.push(point); else groups.set(key, [point]);
  }
  return Array.from(groups.entries());
}

export const WATER_LEGEND = [
  { color: "#e2e8f0", label: "No matched systems / incomplete flags" },
  { color: "#ffffff", label: "No systems flagged" },
  { color: "#ffc9c4", label: "1 system flagged" },
  { color: "#f0685c", label: "2–5 systems flagged" },
  { color: "#a8141f", label: "6+ systems flagged" },
];
export function waterCountyColor(county?: WaterCounty): string {
  if (!county || !county.total || (!county.flagged && county.unknown)) return WATER_LEGEND[0].color;
  return WATER_LEGEND[county.flagged === 0 ? 1 : county.flagged === 1 ? 2 : county.flagged <= 5 ? 3 : 4].color;
}
