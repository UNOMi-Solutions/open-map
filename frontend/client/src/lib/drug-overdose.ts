import { HEALTH_CHOROPLETH_COLORS_NEGATIVE } from "./health-places";

export interface OverdoseCounty {
  fips: string;
  name: string;
  state: string;
  count: number | null;
  countStatus: "reported" | "suppressed" | "unavailable";
  rate: number | null;
  population: number | null;
  populationYear: number | null;
  pendingPercent: number | null;
  completenessNote: string;
  dataAsOf: string;
  dataNote: string;
}

export interface OverdoseResponse {
  period: string;
  availablePeriods: string[];
  dataAsOf: string;
  counties: OverdoseCounty[];
  excludedCountyCount: number;
}

export const OVERDOSE_LEGEND = [
  { label: "0", color: HEALTH_CHOROPLETH_COLORS_NEGATIVE[0] },
  { label: ">0–<10", color: HEALTH_CHOROPLETH_COLORS_NEGATIVE[1] },
  { label: "10–<20", color: HEALTH_CHOROPLETH_COLORS_NEGATIVE[2] },
  { label: "20–<30", color: HEALTH_CHOROPLETH_COLORS_NEGATIVE[3] },
  { label: "30–<40", color: HEALTH_CHOROPLETH_COLORS_NEGATIVE[4] },
  { label: "40–<60", color: HEALTH_CHOROPLETH_COLORS_NEGATIVE[5] },
  { label: "60+", color: HEALTH_CHOROPLETH_COLORS_NEGATIVE[6] },
];
export const OVERDOSE_SUPPRESSED_COLOR = "#94a3b8";
export const OVERDOSE_UNAVAILABLE_COLOR = "#e2e8f0";

export function overdoseFill(county?: OverdoseCounty): string {
  if (county?.countStatus === "suppressed") return OVERDOSE_SUPPRESSED_COLOR;
  const rate = county?.rate;
  if (rate == null || !Number.isFinite(rate) || rate < 0) return OVERDOSE_UNAVAILABLE_COLOR;
  const index = rate === 0 ? 0 : rate < 10 ? 1 : rate < 20 ? 2 : rate < 30 ? 3 : rate < 40 ? 4 : rate < 60 ? 5 : 6;
  return OVERDOSE_LEGEND[index].color;
}

export function overdosePeriodLabel(period: string): string {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) return "Latest available";
  return new Date(`${period}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function overdoseWindowLabel(period: string): string {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) return "";
  const date = new Date(`${period}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 11);
  return `${overdosePeriodLabel(date.toISOString().slice(0, 7))} – ${overdosePeriodLabel(period)}`;
}
