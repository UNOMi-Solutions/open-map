import L from "leaflet";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { useMap } from "react-leaflet";
import { useEffect, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";

type Properties = {
  STATE_NAME?: string;
  STATE_ABBR?: string;
  AllAge_F_AA_Rate?: number | null;
  AllAge_F_Lower_CI?: number | null;
  AllAge_F_Upper_CI?: number | null;
  AllAge_F_Average_Count?: number | null;
};

type StateGeoJSON = FeatureCollection<Polygon | MultiPolygon, Properties>;

const colorForRate = (rate?: number | null) => {
  if (rate == null) return "#d1d5db";
  if (rate < 110) return "#fee5d9";
  if (rate < 120) return "#fcbba1";
  if (rate < 130) return "#fc9272";
  if (rate < 140) return "#fb6a4a";
  return "#cb181d";
};

export default function BreastCancerIncidenceChoropleth({
  setLoading,
}: {
  setLoading?: (state: boolean) => void;
}) {
  const map = useMap();
  const [data, setData] = useState<StateGeoJSON | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading?.(true);

    cachedApiGet<StateGeoJSON>(
      "environment:breastCancerIncidence",
      "/api/v1/environment/breastCancerIncidence",
      CACHE_TTL.ENVIRONMENT_GLOBAL,
    )
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((error) => {
        console.error("[BreastCancerIncidenceChoropleth]", error);
      })
      .finally(() => {
        if (!cancelled) setLoading?.(false);
      });

    return () => {
      cancelled = true;
      setLoading?.(false);
    };
  }, [setLoading]);

  useEffect(() => {
    if (!data) return;

    const layer = L.geoJSON(data, {
      style: (feature) => ({
        fillColor: colorForRate(
          (feature?.properties as Properties | undefined)?.AllAge_F_AA_Rate,
        ),
        weight: 1,
        color: "#fff",
        fillOpacity: 0.75,
      }),
      onEachFeature: (feature, featureLayer) => {
        const p = feature.properties as Properties;
        const popup = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = `${p.STATE_NAME ?? "State"} (${p.STATE_ABBR ?? ""})`;
        popup.appendChild(title);

        const rate = document.createElement("div");
        rate.textContent =
          p.AllAge_F_AA_Rate == null
            ? "Incidence rate: unavailable"
            : `Age-adjusted incidence: ${p.AllAge_F_AA_Rate.toFixed(2)} cases per 100,000 females per year`;
        popup.appendChild(rate);

        if (p.AllAge_F_Lower_CI != null && p.AllAge_F_Upper_CI != null) {
          const ci = document.createElement("div");
          ci.textContent =
            `95% confidence interval: ${p.AllAge_F_Lower_CI}–${p.AllAge_F_Upper_CI}`;
          popup.appendChild(ci);
        }

        if (p.AllAge_F_Average_Count != null) {
          const count = document.createElement("div");
          count.textContent =
            `Average annual cases: ${p.AllAge_F_Average_Count.toLocaleString()}`;
          popup.appendChild(count);
        }

        const source = document.createElement("small");
        source.textContent = "NCI State Cancer Profiles, 2016–2020";
        popup.appendChild(source);
        featureLayer.bindPopup(popup);

        featureLayer.on({
          mouseover: (event) => {
            const path = event.target as L.Path;
            path.setStyle({ weight: 2, color: "#333", fillOpacity: 0.9 });
            path.bringToFront();
          },
          mouseout: (event) => layer.resetStyle(event.target as L.Path),
        });
      },
    }).addTo(map);

    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = () => {
      const box = L.DomUtil.create("div", "choropleth-info");
      box.style.cssText =
        "background:white;padding:8px 10px;border-radius:6px;line-height:1.5;box-shadow:0 1px 5px #777";
      const title = document.createElement("strong");
      title.textContent = "Breast cancer incidence";
      box.appendChild(title);

      const bands = [
        ["< 110", "#fee5d9"],
        ["110–119", "#fcbba1"],
        ["120–129", "#fc9272"],
        ["130–139", "#fb6a4a"],
        ["140+", "#cb181d"],
      ];
      for (const [label, color] of bands) {
        const row = document.createElement("div");
        const swatch = document.createElement("span");
        swatch.style.cssText =
          `display:inline-block;width:12px;height:12px;margin-right:6px;background:${color}`;
        row.appendChild(swatch);
        row.appendChild(document.createTextNode(`${label} per 100,000`));
        box.appendChild(row);
      }
      return box;
    };
    legend.addTo(map);

    return () => {
      map.removeLayer(layer);
      map.removeControl(legend);
    };
  }, [data, map]);

  return null;
}
