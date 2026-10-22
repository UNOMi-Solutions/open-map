import L from "leaflet";
import { useMap } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import {
  COUNTY_CHOROPLETH_STYLE,
  STATE_FIPS_TO_ABBREV,
  percentColor,
  percentLegendHtml,
  useCountyFeatures,
} from "@/lib/county-choropleth";

type DroughtResponse = {
  mapDate?: string | null;
  categories?: string[];
  counties?: Record<string, number[]>;
};

type DroughtLayerProps = {
  /** USDM category index 0–4 (D0–D4). Defaults to D1 (moderate or worse). */
  selectedCategory?: number | null;
  setLoading: (loading: boolean) => void;
};

const DEFAULT_CATEGORY = 1;
const CATEGORY_LABELS = [
  "D0 Abnormally Dry",
  "D1 Moderate",
  "D2 Severe",
  "D3 Extreme",
  "D4 Exceptional",
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function popupHtml(label: string, values: number[] | undefined, categories: string[]): string {
  if (!values) {
    return `
      <div style="min-width:200px;max-width:300px;">
        <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">${label}</h3>
        <p style="font-size:13px;color:#888;">No Drought Monitor data.</p>
      </div>`;
  }
  const rows = categories
    .map((name, i) => {
      const pct = values[i];
      if (pct == null) return "";
      return `<tr>
        <td style="padding:1px 8px 1px 0;">${name}</td>
        <td style="text-align:right;">${pct.toFixed(1)}%</td>
      </tr>`;
    })
    .join("");
  return `
    <div style="min-width:200px;max-width:300px;">
      <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">${label}</h3>
      <p style="margin:0 0 6px;font-size:13px;color:#555;">Percent of county area in each category or worse</p>
      <table style="font-size:12px;border-collapse:collapse;">${rows}</table>
    </div>`;
}

const DroughtLayer = ({ selectedCategory = null, setLoading }: DroughtLayerProps) => {
  const map = useMap();
  const countyFeatures = useCountyFeatures();
  const [data, setData] = useState<DroughtResponse | null>(null);
  const categoryIndex = selectedCategory ?? DEFAULT_CATEGORY;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cachedApiGet<DroughtResponse>(
      "environment:drought",
      "/api/v1/environment/drought",
      CACHE_TTL.LIVE_HAZARDS,
    )
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((error) => {
        console.error("[DroughtLayer] Fetch error:", error);
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const valuesByFips = useMemo(() => {
    const mapByFips = new Map<string, number[]>();
    for (const [fips, values] of Object.entries(data?.counties ?? {})) {
      mapByFips.set(String(fips).padStart(5, "0"), values);
    }
    return mapByFips;
  }, [data]);

  const categories = data?.categories?.length ? data.categories : CATEGORY_LABELS;
  const heading = categories[categoryIndex] ?? CATEGORY_LABELS[categoryIndex];

  useEffect(() => {
    if (countyFeatures.length === 0 || !data) return;

    const info = new L.Control({ position: "topright" });
    info.onAdd = function () {
      const div = L.DomUtil.create("div", "choropleth-info");
      div.innerHTML = `<h4>${heading}</h4>Hover over a county`;
      return div;
    };
    const updateInfo = (label?: string, pct?: number) => {
      const container = (info as unknown as { _container: HTMLElement })._container;
      if (!container) return;
      container.innerHTML =
        `<h4>${heading}</h4>` +
        (label != null
          ? `<b>${label}</b><br/>${(pct ?? 0).toFixed(1)}% of area`
          : "Hover over a county");
    };
    info.addTo(map);

    const geoLayer = L.geoJSON(
      { type: "FeatureCollection", features: countyFeatures } as GeoJSON.FeatureCollection,
      {
        style: (feat) => {
          const fips = String(feat?.id ?? "").padStart(5, "0");
          const pct = valuesByFips.get(fips)?.[categoryIndex] ?? 0;
          return { ...COUNTY_CHOROPLETH_STYLE, fillColor: percentColor(pct) };
        },
        onEachFeature: (feat, layer) => {
          const fips = String(feat.id ?? "").padStart(5, "0");
          const stateAbbrev = STATE_FIPS_TO_ABBREV[fips.slice(0, 2)] ?? "";
          const name = (feat.properties as { name?: string } | null)?.name ?? "";
          const label = stateAbbrev ? `${name}, ${stateAbbrev}` : name;
          const values = valuesByFips.get(fips);

          layer.bindPopup(() => popupHtml(label, values, categories), { maxWidth: 320 });
          layer.on({
            mouseover: (e: L.LeafletMouseEvent) => {
              const target = e.target as L.Path;
              target.setStyle({ weight: 2, opacity: 1, color: "#444" });
              target.bringToFront();
              updateInfo(label, values?.[categoryIndex] ?? 0);
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
        percentLegendHtml(`${heading} coverage`) +
        `<div class="legend-note">${formatDate(data.mapDate)} · U.S. Drought Monitor</div>`;
      return div;
    };
    legend.addTo(map);

    return () => {
      map.removeLayer(geoLayer);
      map.removeControl(info);
      map.removeControl(legend);
    };
  }, [map, countyFeatures, data, valuesByFips, categoryIndex, categories, heading]);

  return null;
};

export default DroughtLayer;
