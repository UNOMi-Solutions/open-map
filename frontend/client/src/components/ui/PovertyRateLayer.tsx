
import L from "leaflet";
import { useMap } from "react-leaflet";
import { useEffect, useState } from "react";
import {
  COUNTY_CHOROPLETH_STYLE,
  STATE_FIPS_TO_ABBREV,
  useCountyFeatures,
} from "@/lib/county-choropleth";

type PovertyRecord = {
  name: string;
  rate: number;
  count: number;
};

type PovertyData = Record<string, PovertyRecord>;

type PovertyRateLayerProps = {
  year: number;
  setLoading: (loading: boolean) => void;
};

// Fixed ranges make colors comparable across different years.
const POVERTY_COLORS = [
  { min: 0, color: "#fff5f0", label: "Below 5%" },
  { min: 5, color: "#fcbba1", label: "5%–9.9%" },
  { min: 10, color: "#fc9272", label: "10%–14.9%" },
  { min: 15, color: "#fb6a4a", label: "15%–19.9%" },
  { min: 20, color: "#de2d26", label: "20%–29.9%" },
  { min: 30, color: "#a50f15", label: "30% or higher" },
];

const NO_DATA_COLOR = "#e5e7eb";

function povertyColor(rate?: number): string {
  if (rate == null || !Number.isFinite(rate) || rate < 0) {
    return NO_DATA_COLOR;
  }

  for (let i = POVERTY_COLORS.length - 1; i >= 0; i--) {
    if (rate >= POVERTY_COLORS[i].min) {
      return POVERTY_COLORS[i].color;
    }
  }

  return NO_DATA_COLOR;
}

const PovertyRateLayer = ({ year, setLoading }: PovertyRateLayerProps) => {
  const map = useMap();
  const countyFeatures = useCountyFeatures();
  const [data, setData] = useState<PovertyData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setData(null);
    setLoading(true);

    fetch(`/data/poverty/${year}.json`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<PovertyData>;
      })
      .then((records) => {
        if (!cancelled) setData(records);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("[PovertyRateLayer] Fetch error:", error);
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [year, setLoading]);

  useEffect(() => {
    if (countyFeatures.length === 0 || !data) return;

    const heading = `Poverty Rate (${year})`;

    const countyLabel = (fips: string, fallback: string): string => {
      const record = data[fips];
      const state = STATE_FIPS_TO_ABBREV[fips.slice(0, 2)];
      const name = record?.name ?? fallback;

      return state ? `${name}, ${state}` : name;
    };

    const dataSource =
      year === 2025
        ? "U.S. Census Bureau, ACS 1-Year"
        : "U.S. Census Bureau, SAIPE";

    const popupHtml = (fips: string, fallback: string): string => {
      const record = data[fips];
      const label = countyLabel(fips, fallback);

      if (!record) {
        return `
          <div style="min-width:190px;">
            <h3>${label}</h3>
            <p>No poverty data available for ${year}.</p>
          </div>
        `;
      }

      return `
        <div style="min-width:220px;">
          <h3 style="margin:0 0 8px;font-size:15px;">
            ${label}
          </h3>
          <p><strong>Year:</strong> ${year}</p>
          <p><strong>Poverty rate:</strong> ${record.rate.toFixed(1)}%</p>
          <p><strong>People in poverty:</strong>
            ${record.count.toLocaleString()}
          </p>
          <p style="font-size:11px;color:#777;">
            Source: ${dataSource}
          </p>
        </div>
      `;
    };

    const info = new L.Control({ position: "topright" });

    info.onAdd = function () {
      const div = L.DomUtil.create("div", "choropleth-info");
      div.innerHTML = `<h4>${heading}</h4>Hover over a county`;
      return div;
    };

    const updateInfo = (label?: string, rate?: number) => {
      const container = (
        info as unknown as { _container: HTMLElement }
      )._container;

      if (!container) return;

      container.innerHTML =
        `<h4>${heading}</h4>` +
        (label
          ? `<b>${label}</b><br/>${
              rate != null ? `${rate.toFixed(1)}%` : "No data"
            }`
          : "Hover over a county");
    };

    info.addTo(map);

    const geoLayer = L.geoJSON(
      {
        type: "FeatureCollection",
        features: countyFeatures,
      } as GeoJSON.FeatureCollection,
      {
        style: (feature) => {
          const fips = String(feature?.id ?? "").padStart(5, "0");

          return {
            ...COUNTY_CHOROPLETH_STYLE,
            fillColor: povertyColor(data[fips]?.rate),
          };
        },

        onEachFeature: (feature, layer) => {
          const fips = String(feature.id ?? "").padStart(5, "0");
          const record = data[fips];

          const fallback =
            (feature.properties as { name?: string } | null)?.name ??
            "Unknown County";

          const label = countyLabel(fips, fallback);

          layer.bindPopup(() => popupHtml(fips, fallback), {
            maxWidth: 340,
          });

          layer.on({
            mouseover: (event: L.LeafletMouseEvent) => {
              const target = event.target as L.Path;

              target.setStyle({
                weight: 2,
                opacity: 1,
                color: "#444",
              });

              target.bringToFront();
              updateInfo(label, record?.rate);
            },

            mouseout: (event: L.LeafletMouseEvent) => {
              geoLayer.resetStyle(event.target as L.Path);
              updateInfo();
            },
          });
        },
      },
    );

    geoLayer.addTo(map);

    const legend = new L.Control({ position: "bottomright" });

    legend.onAdd = function () {
      const div = L.DomUtil.create(
        "div",
        "choropleth-info choropleth-legend",
      );

      div.innerHTML =
        `<h4>Poverty Rate (${year})</h4>` +
        POVERTY_COLORS.map(
          (item) =>
            `<i style="background:${item.color};border:1px solid #ddd;"></i> ${item.label}<br/>`,
        ).join("") +
        `<i style="background:${NO_DATA_COLOR};border:1px solid #ddd;"></i> No data<br/>` +
        `<div class="legend-note">${dataSource}, ${year}</div>`;

      return div;
    };

    legend.addTo(map);

    return () => {
      map.removeLayer(geoLayer);
      map.removeControl(info);
      map.removeControl(legend);
    };
  }, [map, countyFeatures, data, year]);

  return null;
};

export default PovertyRateLayer;
