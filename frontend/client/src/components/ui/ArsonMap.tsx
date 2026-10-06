import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import type {
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
} from "geojson";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import { HEALTH_CHOROPLETH_COLORS_NEGATIVE } from "@/lib/health-places";

type StateCrimeData = Record<string, Record<string, number>>;

type ArsonApiResponse = {
  year: string;
  data: Record<string, StateCrimeData>;
};

type ArsonMapProps = {
  arrestCategory: string;
};

const STATE_NAME_TO_CODE: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
};

const ARSON_COLORS = HEALTH_CHOROPLETH_COLORS_NEGATIVE;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function getArrestTotal(categoryData: Record<string, number>): number {
  return Object.values(categoryData).reduce(
    (total, value) => total + (Number.isFinite(value) && value > 0 ? value : 0),
    0,
  );
}

function getQuantileBreaks(values: number[]): number[] {
  const sortedValues = [...values].sort((a, b) => a - b);
  if (sortedValues.length === 0) return [];

  return ARSON_COLORS.map((_, index) => {
    const quantileIndex = Math.min(
      sortedValues.length - 1,
      Math.floor(((index + 1) / ARSON_COLORS.length) * sortedValues.length) - 1,
    );
    return sortedValues[Math.max(0, quantileIndex)];
  });
}

export default function ArsonMap({ arrestCategory }: ArsonMapProps) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  const legendRef = useRef<L.Control | null>(null);
  const [states, setStates] =
    useState<FeatureCollection<Geometry, GeoJsonProperties> | null>(null);
  const [response, setResponse] = useState<ArsonApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/geo/us-states.geojson")
      .then((res) => {
        if (!res.ok) throw new Error(`State boundaries request failed (${res.status})`);
        return res.json() as Promise<FeatureCollection<Geometry, GeoJsonProperties>>;
      })
      .then((data) => {
        if (!cancelled) setStates(data);
      })
      .catch((fetchError: unknown) => {
        console.error("[ArsonMap] State boundary fetch error:", fetchError);
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Unable to load state boundaries.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    cachedApiGet<ArsonApiResponse>(
      "crime:arsonByState",
      "/api/v1/crime/arsonByState",
      CACHE_TTL.CRIME,
    )
      .then((data) => {
        if (!cancelled) setResponse(data);
      })
      .catch((fetchError: unknown) => {
        console.error("[ArsonMap] Fetch error:", fetchError);
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Unable to load arson data.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const stateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [state, categories] of Object.entries(response?.data ?? {})) {
      const categoryData = categories?.[arrestCategory];
      if (categoryData && Object.keys(categoryData).length > 0) {
        counts.set(state, getArrestTotal(categoryData));
      }
    }
    return counts;
  }, [arrestCategory, response]);

  const breaks = useMemo(
    () => getQuantileBreaks(Array.from(stateCounts.values())),
    [stateCounts],
  );

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (legendRef.current) {
      map.removeControl(legendRef.current);
      legendRef.current = null;
    }
    if (!states) return;

    const colorForValue = (value: number | undefined) => {
      if (value == null || breaks.length === 0) return "#e5e7eb";
      const colorIndex = breaks.findIndex((limit) => value <= limit);
      return ARSON_COLORS[colorIndex < 0 ? ARSON_COLORS.length - 1 : colorIndex];
    };

    const layer = L.geoJSON(states, {
      style: (feature) => {
        const stateName = String(feature?.properties?.name ?? "");
        const stateCode = STATE_NAME_TO_CODE[stateName];
        const count = stateCode ? stateCounts.get(stateCode) : undefined;
        return {
          fillColor: colorForValue(count),
          fillOpacity: 0.68,
          color: "#0a3b55",
          weight: 0.5,
          opacity: 0.65,
        };
      },
      onEachFeature: (feature, stateLayer) => {
        const stateName = String(feature.properties?.name ?? "Unknown");
        const stateCode = STATE_NAME_TO_CODE[stateName];
        const categoryData = stateCode
          ? response?.data?.[stateCode]?.[arrestCategory]
          : undefined;
        const count =
          categoryData && Object.keys(categoryData).length > 0
            ? getArrestTotal(categoryData)
            : undefined;
        const safeStateName = escapeHtml(stateName);
        const safeCategory = escapeHtml(arrestCategory);
        const breakdown =
          categoryData && Object.keys(categoryData).length > 0
            ? Object.entries(categoryData)
                .filter(([, value]) => Number.isFinite(value) && value > 0)
                .map(
                  ([label, value]) =>
                    `<div style="display:flex;justify-content:space-between;gap:12px;"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`,
                )
                .join("")
            : "";
        const popupHtml = `
          <div style="min-width:180px;color:#0c1022;">
            <h3 style="margin:0 0 6px;font-size:15px;font-weight:700;">Arson arrests in ${safeStateName} (${escapeHtml(response?.year ?? "2023")})</h3>
            <div style="font-size:13px;"><strong>${safeCategory}:</strong> ${count == null ? "No data" : count.toLocaleString()}</div>
            ${breakdown ? `<div style="margin-top:8px;font-size:12px;">${breakdown}</div>` : ""}
          </div>`;

        stateLayer.bindPopup(popupHtml, { maxWidth: 300 });
        stateLayer.bindTooltip(
          `${safeStateName}: ${count == null ? "No data" : `${count.toLocaleString()} arrests`}`,
          { sticky: true, opacity: 0.9 },
        );
        stateLayer.on({
          mouseover: (event) => {
            const target = event.target as L.Path;
            target.setStyle({
              weight: 2,
              color: "#0c1022",
              fillOpacity: 0.85,
            });
            target.bringToFront();
          },
          mouseout: (event) => {
            layer.resetStyle(event.target as L.Path);
          },
        });
      },
    }).addTo(map);
    layerRef.current = layer;

    if (breaks.length > 0) {
      const legend = new L.Control({ position: "bottomright" });
      legend.onAdd = () => {
        const container = L.DomUtil.create(
          "div",
          "rounded-lg border border-white/10 bg-[#0c1022]/70 backdrop-blur px-3 py-2 text-xs text-white/90 shadow-lg",
        );
        const barStops = ARSON_COLORS.map(
          (color, index) =>
            `${color} ${(index / (ARSON_COLORS.length - 1)) * 100}%`,
        ).join(", ");
        const tickLabels = breaks
          .map((upper, index) => {
            const lower = index === 0 ? 0 : breaks[index - 1];
            const label =
              index === 0
                ? `≤ ${Math.round(upper)}`
                : `${Math.round(lower)}–${Math.round(upper)}`;
            return `<span style="font-size:10px;white-space:nowrap;">${label}</span>`;
          })
          .join("");

        container.innerHTML = `
          <div style="font-weight:600;font-size:11px;margin-bottom:4px;opacity:0.9;">State aggregates (FBI Crime Data API)</div>
          <div style="font-weight:600;margin-bottom:6px;">Arson arrests: ${escapeHtml(arrestCategory)}</div>
          <div style="height:8px;border-radius:6px;background:linear-gradient(90deg, ${barStops});"></div>
          <div style="display:flex;justify-content:space-between;gap:6px;margin-top:4px;">${tickLabels}</div>
        `;
        L.DomEvent.disableClickPropagation(container);
        return container;
      };
      legend.addTo(map);
      legendRef.current = legend;
    }

    return () => {
      map.removeLayer(layer);
      if (legendRef.current) {
        map.removeControl(legendRef.current);
        legendRef.current = null;
      }
      layerRef.current = null;
    };
  }, [arrestCategory, breaks, map, response, stateCounts, states]);

  useEffect(() => {
    if (error) console.error("[ArsonMap] Heatmap unavailable:", error);
  }, [error]);

  return null;
}
