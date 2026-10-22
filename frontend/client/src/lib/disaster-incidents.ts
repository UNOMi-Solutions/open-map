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

export function formatYearSpan(min: number, max: number): string {
  return min === max ? String(min) : `${min}–${max}`;
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
    if (
      id.startsWith(INCIDENT_YEAR_PREFIX) ||
      id.startsWith("ts-year:") ||
      id.startsWith("ls-year:")
    ) {
      continue;
    }
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

  return rest.filter((id, index) => rest.indexOf(id) === index);
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
