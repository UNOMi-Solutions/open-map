// NASA satellite layers: the curated list (data only) and the date rules shared by every layer.
// To add a layer, add one line to NASA_LAYERS. Everything else (tile URL, zoom levels, available
// dates, legend) is read from NASA's capabilities by the backend (/environment/nasaLayers).

export type NasaGroup =
  | "Imagery"
  | "Weather and Climate"
  | "Air Quality"
  | "Land and Water"
  | "People and Nature";

export type NasaLayer = {
  /** OpenMap id; the sidebar checkbox id is NASA_PREFIX + id */
  id: string;
  /** Exact GIBS identifier, as verified in the audit */
  gibsId: string;
  title: string;
  /** One plain-language line shown under the title in the legend */
  note: string;
  group: NasaGroup;
  /** Photo-like imagery draws opaque and under the data layers */
  imagery?: boolean;
  /** Periods to step back from NASA's newest date. Default 1: the newest period is often still filling in. */
  lag?: number;
  /** For layers without a time dimension: the period the data describes, shown in the legend */
  dataDate?: string;
  /** Gridded land datasets that end near 60 S: GIBS paints the area past the grid as a solid
   *  fill colour or noise, so these layers stop at 60 S (LAND_BOUNDS in NasaLayers.tsx). */
  landOnly?: boolean;
};

export const NASA_PREFIX = "nasa:";
export const NASA_GROUPS: NasaGroup[] = [
  "Imagery",
  "Weather and Climate",
  "Air Quality",
  "Land and Water",
  "People and Nature",
];

// dataDate: the year in the GIBS identifier; Built-up Areas is SEDAC's HBASE dataset (Landsat, 2010).
export const NASA_LAYERS: NasaLayer[] = [
  { id: "true-color", gibsId: "VIIRS_NOAA20_CorrectedReflectance_TrueColor", title: "Satellite Photo (daily)", note: "What the surface and clouds looked like from orbit that day.", group: "Imagery", imagery: true },
  { id: "night-lights", gibsId: "VIIRS_Black_Marble", title: "Earth at Night", note: "City and settlement lights, cloud-free yearly composite.", group: "Imagery", imagery: true },

  { id: "air-temperature", gibsId: "MERRA2_2m_Air_Temperature_Monthly", title: "Air Temperature", note: "Monthly average temperature near the ground (NASA MERRA-2 model).", group: "Weather and Climate" },
  { id: "land-surface-temperature", gibsId: "MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day", title: "Land Surface Temperature (day)", note: "How hot the ground itself gets in daytime, monthly average.", group: "Weather and Climate" },
  { id: "precipitation", gibsId: "MERRA2_Precipitation_Bias_Corrected_Monthly", title: "Precipitation", note: "Monthly rain and snow (NASA MERRA-2 model, gauge corrected).", group: "Weather and Climate" },
  { id: "snowfall", gibsId: "MERRA2_Snowfall_Monthly", title: "Snowfall", note: "Monthly snowfall (NASA MERRA-2 model).", group: "Weather and Climate" },
  { id: "wind-speed", gibsId: "MERRA2_Surface_Wind_Speed_Monthly", title: "Wind Speed", note: "Monthly average wind speed near the surface (NASA MERRA-2 model).", group: "Weather and Climate" },
  { id: "humidity", gibsId: "AIRS_L3_Surface_Relative_Humidity_Monthly_Day", title: "Relative Humidity", note: "Monthly average humidity at the surface (Aqua AIRS).", group: "Weather and Climate" },
  { id: "cloud-cover", gibsId: "MODIS_Terra_Cloud_Fraction_Day", title: "Cloud Cover (daily)", note: "Share of sky covered by cloud on the morning overpass.", group: "Weather and Climate" },

  { id: "aerosols", gibsId: "MERRA2_Total_Aerosol_Optical_Thickness_550nm_Extinction_Monthly", title: "Haze and Smoke (aerosols)", note: "How much particles in the air dim sunlight, monthly average.", group: "Air Quality" },
  { id: "dust", gibsId: "MERRA2_Dust_Surface_Mass_Concentration_PM25_Monthly", title: "Dust (PM2.5)", note: "Fine dust at ground level, monthly average (NASA MERRA-2 model).", group: "Air Quality" },
  { id: "carbon-monoxide", gibsId: "AIRS_L3_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Monthly_Day", title: "Carbon Monoxide", note: "Monthly average in the mid atmosphere, a tracer of fires and combustion.", group: "Air Quality" },
  { id: "methane", gibsId: "AIRS_L3_Methane_400hPa_Volume_Mixing_Ratio_Monthly_Day", title: "Methane", note: "Monthly average in the mid atmosphere (Aqua AIRS).", group: "Air Quality" },
  { id: "sulfur-dioxide", gibsId: "MERRA2_SO2_Column_Mass_Density_Monthly", title: "Sulfur Dioxide", note: "Monthly average from power plants, industry and volcanoes (model).", group: "Air Quality" },
  { id: "carbon-dioxide", gibsId: "AIRS_L3_Carbon_Dioxide_IR_Monthly", title: "Carbon Dioxide", note: "Monthly average in the free troposphere (Aqua AIRS, infrared only).", group: "Air Quality" },

  { id: "vegetation", gibsId: "MODIS_Terra_L3_NDVI_Monthly", title: "Vegetation Greenness", note: "How green and dense plant cover is, monthly (NDVI).", group: "Land and Water" },
  { id: "soil-moisture", gibsId: "SMAP_L4_Analyzed_Surface_Soil_Moisture", title: "Soil Moisture", note: "Water in the top layer of soil (SMAP satellite plus model).", group: "Land and Water" },
  { id: "land-cover", gibsId: "MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual", title: "Land Cover", note: "Forest, cropland, grassland, urban and other cover types, yearly.", group: "Land and Water" },
  { id: "croplands", gibsId: "Agricultural_Lands_Croplands_2000", title: "Croplands", note: "Share of land that is farmed (year 2000).", group: "Land and Water", landOnly: true, dataDate: "2000" },
  { id: "pastures", gibsId: "Agricultural_Lands_Pastures_2000", title: "Pastures", note: "Share of land that is grazed (year 2000).", group: "Land and Water", landOnly: true, dataDate: "2000" },
  { id: "elevation", gibsId: "ASTER_GDEM_Color_Shaded_Relief", title: "Terrain and Elevation", note: "Shaded relief coloured by height above sea level.", group: "Land and Water" },

  { id: "population-density", gibsId: "GPW_Population_Density_2020", title: "Population Density", note: "People per square kilometre (2020).", group: "People and Nature", landOnly: true, dataDate: "2020" },
  { id: "built-up", gibsId: "Landsat_Human_Built-up_And_Settlement_Extent", title: "Built-up Areas", note: "Where buildings and pavement cover the ground (Landsat).", group: "People and Nature", dataDate: "2010" },
  { id: "human-footprint", gibsId: "Human_Footprint_1995-2004", title: "Human Footprint", note: "Combined human pressure on the land (1995 to 2004).", group: "People and Nature", landOnly: true, dataDate: "1995 to 2004" },
  { id: "mammal-richness", gibsId: "Mammal_Richness_Grids_All_Species_2013", title: "Mammal Species Richness", note: "Number of mammal species whose range covers each place.", group: "People and Nature", landOnly: true, dataDate: "2013" },
  { id: "amphibian-richness", gibsId: "Amphibian_Richness_All_Species_2013", title: "Amphibian Species Richness", note: "Number of amphibian species whose range covers each place.", group: "People and Nature", landOnly: true, dataDate: "2013" },
];

/** Changes whenever the set of GIBS ids changes. cached metadata is refetched. */
export const NASA_REGISTRY_KEY = String(
  NASA_LAYERS.map((l) => l.gibsId).join(",").split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7),
);

// ---- backend returns for one GIBS identifier ----
export type NasaRange = { start: string; end: string; interval: string | null };
export type NasaLayerMeta = {
  gibsId: string;
  /** Leaflet-ready URL template; contains "{time}" when the layer has a time dimension */
  template: string;
  format: string;
  maxNativeZoom: number;
  hasTime: boolean;
  defaultTime: string | null;
  ranges: NasaRange[];
  legendUrl: string | null;
};
export type NasaLayersResponse = {
  fetchedAt: string;
  attribution: string;
  sourceUrl: string;
  layers: Record<string, NasaLayerMeta>;
  missing: string[];
};

// ---- Date rules ----
// GIBS answers a request for a date it does not hold with a transparent tile (HTTP 200), so a
// layer looks broken while every request succeeds. Every date is therefore snapped onto a value
// the layer declares: monthly layers to the first of the month, yearly to their year, 8-day
// composites to their boundary, single-value layers to their one value.

const DAY_MS = 86_400_000;
const dayOf = (t: string) => t.slice(0, 10);
const toMs = (day: string) => Date.parse(`${dayOf(day)}T00:00:00Z`);
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const period = (interval: string | null) => /^P(\d+)([DMY])$/.exec(interval ?? "");

/** Sub-daily layers (PT6M, timestamps) only ever show their newest granule */
export const isSubdaily = (m: NasaLayerMeta) =>
  /T\d\d:/.test(m.defaultTime ?? "") || m.ranges.some((r) => r.interval?.startsWith("PT"));

/** The latest declared value on or before `day` (the earliest value when `day` precedes the record). */
export function snapDate(ranges: NasaRange[], day: string): string | null {
  if (!ranges.length) return null;
  const sorted = [...ranges].sort((a, b) => toMs(a.start) - toMs(b.start));
  const t = toMs(day);
  const r = sorted.filter((x) => toMs(x.start) <= t).pop();
  if (!r) return dayOf(sorted[0].start);
  if (t >= toMs(r.end)) return dayOf(r.end);
  const p = period(r.interval);
  if (!p) return dayOf(r.start);
  const n = Number(p[1]);
  const start = toMs(r.start);
  if (p[2] === "D") return toDay(start + Math.floor((t - start) / (n * DAY_MS)) * n * DAY_MS);
  // Months and years count whole months from the start, round down to a mutliple of step
  const a = new Date(start);
  const b = new Date(t);
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  const step = p[2] === "Y" ? n * 12 : n;
  const snapped = new Date(start);
  snapped.setUTCMonth(a.getUTCMonth() + Math.floor(months / step) * step);
  return toDay(snapped.getTime());
}

/** The value sent to GIBS for this layer: null for layers without a time dimension. */
export function resolveTime(meta: NasaLayerMeta, picked: string | null, lag = 1): string | null {
  if (!meta.hasTime || !meta.defaultTime) return null;
  if (isSubdaily(meta)) return meta.defaultTime;
  if (!meta.ranges.length) return picked ?? toDay(toMs(meta.defaultTime) - lag * DAY_MS);
  // Newest complete value: NASA's default, stepped back `lag` periods.
  let latest = snapDate(meta.ranges, meta.defaultTime)!;
  for (let i = 0; i < lag; i++) {
    const previous = snapDate(meta.ranges, toDay(toMs(latest) - DAY_MS))!;
    if (toMs(previous) >= toMs(latest)) break;
    latest = previous;
  }
  if (!picked || toMs(picked) >= toMs(latest)) return latest;
  return snapDate(meta.ranges, picked);
}

/** String formats - "Aug 2026" for monthly, "2023" for yearly, "Nov 13, 2026" otherwise */
export function describeTime(meta: NasaLayerMeta, time: string | null): string {
  if (!time) return "Fixed dataset";
  const range = meta.ranges.find((r) => toMs(r.start) <= toMs(time) && toMs(time) <= toMs(r.end));
  const p = period(range?.interval ?? null);
  const unit = p?.[2];
  const date = new Date(toMs(time)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    ...(unit === "Y" ? {} : { month: "short" }),
    ...(unit === "M" || unit === "Y" ? {} : { day: "numeric" }),
  });
  if (isSubdaily(meta)) return `Latest pass, ${date}`;
  const cadence = !p ? "" : unit === "M" ? "Monthly" : unit === "Y" ? "Yearly" : p[1] === "1" ? "Daily" : `${p[1]}-day`;
  return cadence ? `${cadence}, ${date}` : date;
}

/**
 * Every date this layer can show, as UTC-midnight timestamps, up to its newest complete period
 * (the same "latest" resolveTime uses). Feeds the global timeline so it only offers real dates.
 */
export function availableDays(meta: NasaLayerMeta, lag = 1): number[] {
  if (!meta.hasTime || !meta.defaultTime) return [];
  const latest = resolveTime(meta, null, lag);
  if (!latest) return [];
  if (isSubdaily(meta)) return [toMs(latest)];
  const last = toMs(latest);
  const out: number[] = [];
  for (const r of meta.ranges) {
    const start = toMs(r.start);
    const end = Math.min(toMs(r.end), last);
    const p = period(r.interval);
    if (!p) {
      if (start <= last) out.push(start);
      continue;
    }
    const n = Number(p[1]);
    for (let i = 0, t = start; t <= end; i++) {
      out.push(t);
      if (p[2] === "D") t = start + (i + 1) * n * DAY_MS;
      else {
        const d = new Date(start);
        d.setUTCMonth(d.getUTCMonth() + (i + 1) * n * (p[2] === "Y" ? 12 : 1));
        t = d.getTime();
      }
    }
  }
  return out;
}
