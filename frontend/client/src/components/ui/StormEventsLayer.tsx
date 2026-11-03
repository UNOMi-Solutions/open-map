import L from "leaflet";
import { useMap } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import {
  COUNT_PALETTES,
  COUNTY_CHOROPLETH_STYLE,
  STATE_FIPS_TO_ABBREV,
  countColor,
  countLegendHtml,
  quantileBreaks,
  useCountyFeatures,
  type CountPalette,
} from "@/lib/county-choropleth";
import { formatYearSpan } from "@/lib/disaster-incidents";
import {
  getTimelineDateRange,
  getTimelineYearRange,
  parseTimelineDate,
  type TimelineDateRange,
} from "@/lib/timeline";

// Per county FIPS: category -> year -> [event count, deaths, injuries, damage $]
type YearBucket = [number, number, number, number];
type CountyStormSummary = Record<string, Record<string, YearBucket> | YearBucket>;

type StormEventsResponse = {
  dateRange?: { start: string; end: string | null };
  counties?: Record<string, CountyStormSummary>;
};

type Totals = { count: number; deaths: number; injuries: number; damage: number };

export const SEVERE_WEATHER_CATEGORIES = [
  "Tornado", "Thunderstorm Wind", "Hail", "Flood", "Hurricane / Tropical Storm",
  "Winter Storm", "High Wind", "Debris Flow",
];
export const EXTREME_TEMPERATURE_CATEGORIES = ["Extreme Heat", "Extreme Cold"];

/** Heat and high wind stay red; the rest pick a color that reads as the hazard. */
const CATEGORY_PALETTE: Record<string, CountPalette> = {
  "Thunderstorm Wind": COUNT_PALETTES.thunderstorm,
  Hail: COUNT_PALETTES.hail,
  Flood: COUNT_PALETTES.flood,
  "Hurricane / Tropical Storm": COUNT_PALETTES.hurricane,
  "Winter Storm": COUNT_PALETTES.winter,
  "High Wind": COUNT_PALETTES.red,
  "Extreme Heat": COUNT_PALETTES.red,
  "Extreme Cold": COUNT_PALETTES.cold,
};

function paletteFor(categories: string[]): CountPalette {
  return CATEGORY_PALETTE[categories[0] ?? ""] ?? COUNT_PALETTES.red;
}

type StormEventsLayerProps = {
  title: string;
  /** NOAA categories this layer covers; counts are summed across them */
  categories: string[];
  selectedCategory?: string | null;
  setLoading: (loading: boolean) => void;
  timelineRange: TimelineDateRange | null;
  onDateRangeChange: (datasetId: string, range: TimelineDateRange | null) => void;
};

function formatMonth(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function formatDamage(dollars: number): string {
  if (dollars >= 1e9) return `$${(dollars / 1e9).toFixed(1)}B`;
  if (dollars >= 1e6) return `$${(dollars / 1e6).toFixed(1)}M`;
  if (dollars >= 1e3) return `$${Math.round(dollars / 1e3)}K`;
  return `$${Math.round(dollars)}`;
}

function bucketInRange(bucket: YearBucket | Record<string, YearBucket> | undefined, minYear: number | null, maxYear: number | null): YearBucket {
  const totals: YearBucket = [0, 0, 0, 0];
  if (!bucket) return totals;
  if (Array.isArray(bucket)) {
    const coversAllRecent = (minYear == null || minYear <= 2024) && (maxYear == null || maxYear >= new Date().getFullYear());
    return coversAllRecent ? bucket : totals;
  }
  for (const [year, values] of Object.entries(bucket)) {
    const y = Number(year);
    if (minYear != null && y < minYear) continue;
    if (maxYear != null && y > maxYear) continue;
    totals[0] += values[0] ?? 0;
    totals[1] += values[1] ?? 0;
    totals[2] += values[2] ?? 0;
    totals[3] += values[3] ?? 0;
  }
  return totals;
}

function sumCategories(
  summary: CountyStormSummary | undefined,
  categories: string[],
  minYear: number | null,
  maxYear: number | null,
): Totals {
  const totals = { count: 0, deaths: 0, injuries: 0, damage: 0 };
  for (const category of categories) {
    const entry = bucketInRange(summary?.[category], minYear, maxYear);
    totals.count += entry[0];
    totals.deaths += entry[1];
    totals.injuries += entry[2];
    totals.damage += entry[3];
  }
  return totals;
}

function popupHtml(
  title: string,
  summary: CountyStormSummary | undefined,
  categories: string[],
  selectedCategory: string | null,
  minYear: number | null,
  maxYear: number | null,
): string {
  const shown = selectedCategory ? [selectedCategory] : categories;
  const totals = sumCategories(summary, shown, minYear, maxYear);
  if (totals.count === 0) {
    return `
      <div style="min-width:200px;max-width:300px;">
        <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">${title}</h3>
        <p style="font-size:13px;color:#888;">No events recorded.</p>
      </div>`;
  }

  const rows = shown
    .map((category) => [category, bucketInRange(summary?.[category], minYear, maxYear)[0]] as const)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([category, count]) => `
        <tr>
          <td style="padding:1px 8px 1px 0;">${category}</td>
          <td style="text-align:right;">${count.toLocaleString()}</td>
        </tr>`,
    )
    .join("");

  // Zone-wide events are split across counties, so casualties can be fractional
  const deaths = Math.round(totals.deaths);
  const injuries = Math.round(totals.injuries);

  return `
    <div style="min-width:200px;max-width:300px;">
      <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">${title}</h3>
      <p style="margin:0 0 6px;font-size:13px;color:#555;">${totals.count.toLocaleString()} event${totals.count === 1 ? "" : "s"}</p>
      <table style="font-size:12px;border-collapse:collapse;margin-bottom:6px;">${rows}</table>
      <p style="margin:2px 0 0;font-size:12px;"><strong>Deaths:</strong> ${deaths.toLocaleString()} · <strong>Injuries:</strong> ${injuries.toLocaleString()}</p>
      <p style="margin:2px 0 0;font-size:12px;"><strong>Property &amp; crop damage:</strong> ${formatDamage(totals.damage)}</p>
    </div>`;
}

const StormEventsLayer = ({
  title,
  categories,
  selectedCategory = null,
  setLoading,
  timelineRange,
  onDateRangeChange,
}: StormEventsLayerProps) => {
  const map = useMap();
  const countyFeatures = useCountyFeatures();
  const [data, setData] = useState<StormEventsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cachedApiGet<StormEventsResponse>(
      "environment:stormEvents:v3",
      "/api/v1/environment/stormEvents",
      CACHE_TTL.ENVIRONMENT_GLOBAL,
    )
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((error) => {
        console.error("[StormEventsLayer] Fetch error:", error);
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const endDate = data?.dateRange?.end ?? (data?.dateRange?.start ? new Date().toISOString().slice(0, 10) : null);
    onDateRangeChange(
      "storm-events",
      getTimelineDateRange([
        parseTimelineDate(data?.dateRange?.start),
        parseTimelineDate(endDate),
      ]),
    );
    return () => onDateRangeChange("storm-events", null);
  }, [data, onDateRangeChange]);

  const timelineYears = getTimelineYearRange(timelineRange);
  const minYear = timelineYears?.min ?? null;
  const maxYear = timelineYears?.max ?? null;

  const shownCategories = useMemo(
    () => (selectedCategory ? [selectedCategory] : categories),
    [selectedCategory, categories],
  );

  const countByFips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [fips, summary] of Object.entries(data?.counties ?? {})) {
      const { count } = sumCategories(summary, shownCategories, minYear, maxYear);
      if (count > 0) counts.set(fips, count);
    }
    return counts;
  }, [data, shownCategories, minYear, maxYear]);

  const breaks = useMemo(() => quantileBreaks(Array.from(countByFips.values())), [countByFips]);
  const palette = useMemo(() => paletteFor(shownCategories), [shownCategories]);

  useEffect(() => {
    if (countyFeatures.length === 0 || !data) return;

    const heading = selectedCategory ? `${title}: ${selectedCategory}` : title;
    const info = new L.Control({ position: "topright" });
    info.onAdd = function () {
      const div = L.DomUtil.create("div", "choropleth-info");
      div.innerHTML = `<h4>${heading}</h4>Hover over a county`;
      return div;
    };
    const updateInfo = (label?: string, count?: number) => {
      const container = (info as unknown as { _container: HTMLElement })._container;
      if (!container) return;
      container.innerHTML =
        `<h4>${heading}</h4>` +
        (label != null
          ? `<b>${label}</b><br/>${(count ?? 0).toLocaleString()} event${count === 1 ? "" : "s"}`
          : "Hover over a county");
    };
    info.addTo(map);

    const geoLayer = L.geoJSON(
      { type: "FeatureCollection", features: countyFeatures } as GeoJSON.FeatureCollection,
      {
        style: (feat) => {
          const fips = String(feat?.id ?? "").padStart(5, "0");
          return { ...COUNTY_CHOROPLETH_STYLE, fillColor: countColor(countByFips.get(fips) ?? 0, breaks, palette) };
        },
        onEachFeature: (feat, layer) => {
          const fips = String(feat.id ?? "").padStart(5, "0");
          const stateAbbrev = STATE_FIPS_TO_ABBREV[fips.slice(0, 2)] ?? "";
          const name = (feat.properties as { name?: string } | null)?.name ?? "";
          const label = stateAbbrev ? `${name}, ${stateAbbrev}` : name;

          layer.bindPopup(() => popupHtml(label, data.counties?.[fips], categories, selectedCategory, minYear, maxYear), {
            maxWidth: 320,
          });
          layer.on({
            mouseover: (e: L.LeafletMouseEvent) => {
              const target = e.target as L.Path;
              target.setStyle({ weight: 2, opacity: 1, color: "#444" });
              target.bringToFront();
              updateInfo(label, countByFips.get(fips) ?? 0);
            },
            mouseout: (e: L.LeafletMouseEvent) => {
              geoLayer.resetStyle(e.target as L.Path);
              updateInfo();
            },
          });
        },
      },
    );
    geoLayer.addTo(map);

    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "choropleth-info gradient-legend");
      div.innerHTML =
        countLegendHtml(`${title} events per county`, breaks, palette) +
        `<div class="legend-note">${
          minYear != null && maxYear != null
            ? formatYearSpan(minYear, maxYear)
            : `${formatMonth(data.dateRange?.start)} – ${formatMonth(data.dateRange?.end)}`
        } · NOAA</div>`;
      return div;
    };
    legend.addTo(map);

    return () => {
      map.removeLayer(geoLayer);
      map.removeControl(info);
      map.removeControl(legend);
    };
  }, [map, countyFeatures, data, countByFips, breaks, palette, selectedCategory, categories, title, minYear, maxYear]);

  return null;
};

export default StormEventsLayer;
