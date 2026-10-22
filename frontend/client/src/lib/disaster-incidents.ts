/** Sidebar id for the Natural Disaster Incidents disclosure. Not a map layer. */
export const INCIDENT_MENU_ID = "natural-disaster-incidents";

export const PATH_INCIDENT_LAYERS = [
  { id: "ndi-tornado", label: "Tornadoes" },
] as const;

export const STORM_INCIDENT_LAYERS = [
  { id: "ndi-thunderstorm-wind", label: "Thunderstorm Wind", category: "Thunderstorm Wind" },
  { id: "ndi-hail", label: "Hail", category: "Hail" },
  { id: "ndi-flood", label: "Floods", category: "Flood" },
  { id: "ndi-hurricane", label: "Hurricanes / Tropical Storms", category: "Hurricane / Tropical Storm" },
  { id: "ndi-winter-storm", label: "Winter Storms", category: "Winter Storm" },
  { id: "ndi-high-wind", label: "High Wind", category: "High Wind" },
  { id: "extreme-heat", label: "Extreme Heat", category: "Extreme Heat" },
  { id: "extreme-cold", label: "Extreme Cold", category: "Extreme Cold" },
] as const;

export const POINT_INCIDENT_LAYERS = [
  { id: "ndi-debris-flow", label: "Debris Flow" },
  { id: "landslides", label: "Landslides" },
  { id: "earthquakes", label: "Earthquakes" },
  { id: "volcanoes", label: "Volcanic Activity" },
  { id: "tsunamis", label: "Tsunamis" },
  { id: "wildfires", label: "Wildfires" },
  { id: "drought", label: "Drought" },
] as const;

export const INCIDENT_TYPE_IDS = new Set<string>([
  ...PATH_INCIDENT_LAYERS.map((layer) => layer.id),
  ...STORM_INCIDENT_LAYERS.map((layer) => layer.id),
  ...POINT_INCIDENT_LAYERS.map((layer) => layer.id),
]);

export const INCIDENT_YEAR_PREFIX = "iy:";

export const INCIDENT_FILTER_PREFIXES = [
  "eq-mag:",
  "vo-alert:",
  "ts-year:",
  "ls-year:",
  INCIDENT_YEAR_PREFIX,
  "wf-acres:",
  "dr-cat:",
];

const RECENT_INCIDENT_START_YEAR = 2024;

export type IncidentYearSpec = {
  min: number;
  max: number;
  defaultMin: number;
  defaultMax: number;
  /** Long historical catalogs get a larger slider. */
  prominent: boolean;
};

export function incidentYearSpec(typeId: string): IncidentYearSpec | null {
  const max = new Date().getFullYear();
  if (typeId === "tsunamis") {
    return { min: 1900, max, defaultMin: 2000, defaultMax: max, prominent: true };
  }
  if (typeId === "landslides") {
    return { min: 2000, max, defaultMin: 2000, defaultMax: max, prominent: true };
  }
  const recent =
    PATH_INCIDENT_LAYERS.some((layer) => layer.id === typeId) ||
    STORM_INCIDENT_LAYERS.some((layer) => layer.id === typeId) ||
    typeId === "ndi-debris-flow" ||
    typeId === "wildfires";
  if (recent) {
    return {
      min: RECENT_INCIDENT_START_YEAR,
      max,
      defaultMin: RECENT_INCIDENT_START_YEAR,
      defaultMax: max,
      prominent: false,
    };
  }
  return null;
}

export function formatYearSpan(min: number, max: number): string {
  return min === max ? String(min) : `${min}–${max}`;
}

export function isoYear(value: string | null | undefined): number | null {
  if (!value) return null;
  const year = Number(String(value).slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : null;
}

export function timestampYear(ms: number | null | undefined): number | null {
  if (ms == null) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date.getFullYear();
}

export function yearInRange(year: number | null, minYear: number | null, maxYear: number | null): boolean {
  if (year == null) return true;
  if (minYear != null && year < minYear) return false;
  if (maxYear != null && year > maxYear) return false;
  return true;
}

/** Selected incident type's year window. Null when that type has no year slider. */
export function incidentYearSelection(layers: string[]): { min: number; max: number } | null {
  const typeId = layers.find((id) => INCIDENT_TYPE_IDS.has(id));
  if (!typeId) return null;
  const spec = incidentYearSpec(typeId);
  if (!spec) return null;

  const token = layers.find((id) => id.startsWith(INCIDENT_YEAR_PREFIX));
  if (token) {
    const [rawMin, rawMax] = token.slice(INCIDENT_YEAR_PREFIX.length).split("-").map(Number);
    if (Number.isFinite(rawMin) && Number.isFinite(rawMax)) {
      const min = Math.max(spec.min, Math.min(rawMin, rawMax));
      const max = Math.min(spec.max, Math.max(rawMin, rawMax));
      return { min, max };
    }
  }

  const legacyPrefix = typeId === "tsunamis" ? "ts-year:" : typeId === "landslides" ? "ls-year:" : null;
  if (legacyPrefix) {
    const legacy = layers.find((id) => id.startsWith(legacyPrefix));
    if (legacy) {
      const min = Number(legacy.slice(legacyPrefix.length));
      if (Number.isFinite(min)) return { min: Math.max(spec.min, Math.min(spec.max, min)), max: spec.max };
    }
  }

  return { min: spec.defaultMin, max: spec.defaultMax };
}

const LEGACY_STORM_TYPE_TO_LAYER: Record<string, string> = {
  Tornado: "ndi-tornado",
  "Thunderstorm Wind": "ndi-thunderstorm-wind",
  Hail: "ndi-hail",
  Flood: "ndi-flood",
  "Hurricane / Tropical Storm": "ndi-hurricane",
  "Winter Storm": "ndi-winter-storm",
  "High Wind": "ndi-high-wind",
  "Debris Flow": "ndi-debris-flow",
  "Extreme Heat": "extreme-heat",
  "Extreme Cold": "extreme-cold",
  Drought: "drought",
  Wildfire: "wildfires",
};

function isIncidentFilter(id: string): boolean {
  return INCIDENT_FILTER_PREFIXES.some((prefix) => id.startsWith(prefix));
}

/** Drop FEMA declaration layers and promote old storm-event filters to type buttons. */
export function migrateIncidentLayers(layers: string[]): string[] {
  const rest: string[] = [];
  let incidentType: string | null = null;
  let openMenu = false;

  for (const id of layers) {
    if (id.startsWith("nd-type:")) continue;
    if (id === "avalanches" || id.startsWith("av-year:")) continue;
    if (id === "storm-events" || id === "severe-weather") {
      openMenu = true;
      continue;
    }
    if (id.startsWith("se-type:")) {
      const mapped = LEGACY_STORM_TYPE_TO_LAYER[id.slice("se-type:".length)];
      if (mapped && !incidentType) incidentType = mapped;
      continue;
    }
    if (INCIDENT_TYPE_IDS.has(id) && !incidentType) incidentType = id;
    rest.push(id);
  }

  if (incidentType) openMenu = true;
  if (openMenu && !rest.includes(INCIDENT_MENU_ID)) rest.push(INCIDENT_MENU_ID);
  if (incidentType && !rest.includes(incidentType)) rest.push(incidentType);

  let legacyMin: number | null = null;
  const migrated = rest.filter((id) => {
    if (id.startsWith("ts-year:") || id.startsWith("ls-year:")) {
      const year = Number(id.split(":")[1]);
      if (Number.isFinite(year)) legacyMin = year;
      return false;
    }
    return true;
  });
  if (legacyMin != null && !migrated.some((id) => id.startsWith(INCIDENT_YEAR_PREFIX))) {
    migrated.push(`${INCIDENT_YEAR_PREFIX}${legacyMin}-${new Date().getFullYear()}`);
  }

  return migrated.filter((id, index) => migrated.indexOf(id) === index);
}

export function stormCategoryFromLayers(layers: string[]): string | null {
  const selected = STORM_INCIDENT_LAYERS.find((layer) => layers.includes(layer.id));
  return selected?.category ?? null;
}

export function stripIncidentSelections(layers: string[]): string[] {
  return layers.filter(
    (id) => id !== INCIDENT_MENU_ID && !INCIDENT_TYPE_IDS.has(id) && !isIncidentFilter(id),
  );
}

export function selectIncidentType(layers: string[], typeId: string): string[] {
  return [
    ...stripIncidentSelections(layers),
    INCIDENT_MENU_ID,
    typeId,
  ];
}
