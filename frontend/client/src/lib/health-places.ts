/**
 * County health choropleth layers from CDC PLACES (model-based, 2021 release).
 * Data files: /data/health/{id}.json — GEOID (5-digit county FIPS) → prevalence %.
 * Run: node scripts/fetch-health-places.mjs
 */
export const HEALTH_PLACES_SOURCE = "CDC PLACES — Local Data for Better Health (county, 2021)";

/** Layer ids that have a generated JSON file under /data/health/ */
export const HEALTH_WIRED_LAYER_IDS = new Set([
  "heart-disease",
  "cancer",
  "breast-cancer",
  "diabetes",
  "colon-cancer",
  "lung-cancer",
  "kidney-disease",
  "smokers",
  "obesity",
  "alcoholism",
  "mental-health",
  "best-healthcare-coverage",
  "worst-healthcare-coverage",
  "most-out-of-shape-population",
  "healthiest-population",
]);

/** All Health accordion checkbox ids (includes topics without a PLACES measure). */
export const HEALTH_ALL_LAYER_IDS = new Set([
  "heart-disease",
  "cancer",
  "breast-cancer",
  "diabetes",
  "pre-diabetic",
  "colon-cancer",
  "prostate-cancer",
  "aids",
  "hiv",
  "std",
  "obesity",
  "smallpox",
  "covid-19",
  "lung-cancer",
  "kidney-disease",
  "smokers",
  "cannabis-smokers",
  "illegal-hard-drug-use",
  "healthy-eating",
  "alcoholism",
  "drug-addiction",
  "mental-health",
  "best-healthcare-coverage",
  "worst-healthcare-coverage",
  "most-out-of-shape-population",
  "healthiest-population",
]);

export const HEALTH_LAYER_META: Record<
  string,
  { label: string; unit: "%"; subtitle?: string }
> = {
  "heart-disease": {
    label: "Coronary heart disease (age-adjusted prevalence)",
    unit: "%",
  },
  cancer: {
    label: "Cancer excluding skin cancer (age-adjusted prevalence)",
    unit: "%",
  },
  "breast-cancer": {
    label: "Mammography screening, women 50–74 (proxy)",
    unit: "%",
    subtitle: "Screening rate, not incidence",
  },
  diabetes: {
    label: "Diagnosed diabetes (age-adjusted prevalence)",
    unit: "%",
  },
  "colon-cancer": {
    label: "Colorectal cancer screening, ages 50–75 (proxy)",
    unit: "%",
  },
  "lung-cancer": {
    label: "COPD (age-adjusted prevalence, respiratory proxy)",
    unit: "%",
  },
  "kidney-disease": {
    label: "Chronic kidney disease (age-adjusted prevalence)",
    unit: "%",
  },
  smokers: {
    label: "Current cigarette smoking (age-adjusted prevalence)",
    unit: "%",
  },
  obesity: {
    label: "Obesity (age-adjusted prevalence)",
    unit: "%",
  },
  alcoholism: {
    label: "Binge drinking (age-adjusted prevalence, alcohol-related risk)",
    unit: "%",
  },
  "mental-health": {
    label: "Depression (age-adjusted prevalence)",
    unit: "%",
  },
  "best-healthcare-coverage": {
    label: "Estimated adults 18–64 with health insurance (100 − uninsured %)",
    unit: "%",
  },
  "worst-healthcare-coverage": {
    label: "Current lack of health insurance, ages 18–64 (age-adjusted)",
    unit: "%",
  },
  "most-out-of-shape-population": {
    label: "No leisure-time physical activity (age-adjusted prevalence)",
    unit: "%",
  },
  "healthiest-population": {
    label: "Good self-rated health (100 − fair/poor %)",
    unit: "%",
  },
};

export function getHealthLayerMeta(id: string) {
  return (
    HEALTH_LAYER_META[id] ?? {
      label: id,
      unit: "%" as const,
    }
  );
}

/** Higher modeled % means better outcomes (coverage, uptake, wellbeing). Choropleth: white → blue. */
export const HEALTH_LAYER_POSITIVE_DIRECTION = new Set<string>([
  "best-healthcare-coverage",
  "breast-cancer",
  "colon-cancer",
  "healthiest-population",
]);

/** Matches population choropleth bin count — low values stay near white; high trend blue or red. */
export const HEALTH_CHOROPLETH_COLORS_POSITIVE = [
  "#ffffff",
  "#eaf4fb",
  "#c8ddf0",
  "#9cbcde",
  "#6ba3ce",
  "#3f7cae",
  "#1c5b8f",
];

export const HEALTH_CHOROPLETH_COLORS_NEGATIVE = [
  "#ffffff",
  "#fff0ee",
  "#ffc9c4",
  "#fc9a91",
  "#f0685c",
  "#d8342c",
  "#a8141f",
];

export function getHealthChoroplethColors(healthMetricId: string): string[] {
  return HEALTH_LAYER_POSITIVE_DIRECTION.has(healthMetricId)
    ? HEALTH_CHOROPLETH_COLORS_POSITIVE
    : HEALTH_CHOROPLETH_COLORS_NEGATIVE;
}
