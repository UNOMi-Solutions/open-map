// Air Quality Heatmap – State-level choropleth showing AQI from the backend API.

import L from "leaflet";
import { useMap } from "react-leaflet";
import { useEffect, useState, useRef, useMemo } from "react";
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties } from "geojson";

const STATE_ABBREVS = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI",
  "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
  "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
  "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY",
] as const;

// Map full state names (from GeoJSON) to 2-letter codes 
const STATE_NAME_TO_CODE: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO",
  Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID",
  Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA",
  Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH",
  Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT", Virginia: "VA",
  Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

// EPA AQI ranges
const AQI_GRADES = [0, 51, 101, 151, 201, 301];

const API_BASE = "http://localhost:8000/api/v1/environment/airQuality";

// Convert state name or code to 2-letter code
function toStateCode(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;
  if (s.length === 2) return s.toUpperCase();
  return STATE_NAME_TO_CODE[s] ?? null;
}

// Extract AQI from API 
// v stands for value in the api response
function getAqi(rec: Record<string, unknown>): number | undefined {
  const keys = ["aqi", "AQI", "AirQualityIndex", "airQualityIndex", "value", "Value"];
  for (const k of keys) {
    const v = rec[k];
    if (v != null) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n <= 500) return n;
    }
  }
  // Aqi values are often stored in an observations array to represennt multiple measurements
  if (Array.isArray(rec.observations) && rec.observations[0]) {
    return getAqi(rec.observations[0] as Record<string, unknown>);
  }
  const cat = rec.Category as Record<string, unknown> | undefined;
  if (cat?.Number != null) {
    const n = Number(cat.Number);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

// API response turned into list of records to iterate through
function parseApiResponse(data: unknown, stateCode: string): Record<string, unknown>[] {
  if (data == null) return [];
  if (Array.isArray(data)) {
    return data.map((r) => ({ ...(r as Record<string, unknown>), _stateCode: stateCode }));
  }
  if (typeof data !== "object") return [];

  const d = data as Record<string, unknown>;

  // Try array properties first
  const arrKeys = ["observations", "results", "airQuality", "counties", "data", "items"];
  for (const k of arrKeys) {
    const val = d[k];
    if (Array.isArray(val)) {
      return val.map((r) => ({ ...(r as Record<string, unknown>), _stateCode: stateCode }));
    }
  }

  // Single-object response: { data: { aqi: 41, ... } } or { aqi: 41, ... }
  const inner = d.data as Record<string, unknown> | undefined;
  const hasAqi = (obj: Record<string, unknown>) => obj.aqi != null || obj.AQI != null;
  if (inner && typeof inner === "object" && hasAqi(inner)) {
    return [{ ...inner, _stateCode: stateCode }];
  }
  if (hasAqi(d)) {
    return [{ ...d, _stateCode: stateCode }];
  }
  return [];
}

// EPA AQI color scale
function getAqiColor(aqi: number | undefined): string {
  if (aqi == null || !Number.isFinite(aqi)) return "#e5e7eb";
  if (aqi <= 50) return "#00e400";
  if (aqi <= 100) return "#ffff00";
  if (aqi <= 150) return "#ff7e00";
  if (aqi <= 200) return "#ff0000";
  if (aqi <= 300) return "#8f3f97";
  return "#7e0023";
}

// Human-readable AQI category 
function getAqiCategory(aqi: number | undefined): string {
  if (aqi == null || !Number.isFinite(aqi)) return "No data";
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

function popup(stateName: string, aqi: number | undefined): string {
  const aqiStr = aqi != null && Number.isFinite(aqi) ? String(aqi) : "—";
  const category = getAqiCategory(aqi);
  return `
    <div style="min-width:180px;">
      <h3 style="margin:0 0 6px;font-size:15px;font-weight:700;">${stateName}</h3>
      <p style="margin:0;font-size:13px;"><strong>AQI:</strong> ${aqiStr}</p>
      <p style="margin:2px 0 0;font-size:12px;"><strong>Category:</strong> ${category}</p>
    </div>`;
}

type AirQualityHeatmapProps = { selectedStateCode?: string | null };

const AirQualityHeatmap = ({ selectedStateCode }: AirQualityHeatmapProps) => {
  const map = useMap();
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const infoRef = useRef<L.Control | null>(null);
  const legendRef = useRef<L.Control | null>(null);

  const [statesFC, setStatesFC] = useState<FeatureCollection<Geometry, GeoJsonProperties> | null>(null);
  const [airQualityData, setAirQualityData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  // Load state boundaries
  useEffect(() => {
    fetch("/geo/us-states.geojson")
      .then((res) => res.json())
      .then((json) => setStatesFC(json))
      .catch((err) => console.error("[AirQualityHeatmap] Failed to load states:", err));
  }, []);

  // Fetch air quality per state
  useEffect(() => {
    setAirQualityData([]);
    setLoading(true);
    const urls = selectedStateCode
      ? [`${API_BASE}?stateCode=${encodeURIComponent(selectedStateCode)}`]
      : STATE_ABBREVS.map((c) => `${API_BASE}?stateCode=${encodeURIComponent(c)}`);

    Promise.all(
      urls.map((url) =>
        fetch(url, { method: "GET", headers: { "Content-Type": "application/json" }, cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            const stateCode = new URL(url).searchParams.get("stateCode") ?? "";
            return parseApiResponse(data, stateCode);
          })
          .catch(() => [])
      )
    )
      .then((results) => setAirQualityData(results.flat()))
      .catch((err) => {
        console.error("[AirQualityHeatmap] Fetch error:", err);
        setAirQualityData([]);
      })
      .finally(() => setLoading(false));
  }, [selectedStateCode]);

  // Aggregate: max AQI per state
  const aqiByState = useMemo(() => {
    const m = new Map<string, number>();
    for (const rec of airQualityData) {
      const code = toStateCode(
        rec._stateCode ?? rec.stateCode ?? rec.StateCode ?? rec.state ?? rec.State ?? rec.StateName ?? rec.stateName
      );
      if (!code) continue;
      const aqi = getAqi(rec);
      if (aqi == null) continue;
      const prev = m.get(code);
      if (prev == null || aqi > prev) m.set(code, aqi);
    }
    return m;
  }, [airQualityData]);

  // Render choropleth + info + legend
  useEffect(() => {
    if (geoLayerRef.current) map.removeLayer(geoLayerRef.current);
    if (infoRef.current) map.removeControl(infoRef.current);
    if (legendRef.current) map.removeControl(legendRef.current);
    geoLayerRef.current = null;
    infoRef.current = null;
    legendRef.current = null;

    if (loading || !statesFC) return;

    // Hover info (top-right)
    const info = new L.Control({ position: "topright" });
    info.onAdd = () => {
      const div = L.DomUtil.create("div", "choropleth-info");
      div.innerHTML = "<h4>Air Quality (AQI)</h4>Hover over a state";
      return div;
    };
    const updateInfo = (label?: string, aqi?: number) => {
      const el = (info as unknown as { _container: HTMLElement })._container;
      if (!el) return;
      el.innerHTML =
        "<h4>Air Quality (AQI)</h4>" +
        (label != null ? `<b>${label}</b><br/>AQI: ${aqi != null ? aqi : "—"}` : "Hover over a state");
    };
    info.addTo(map);
    infoRef.current = info;

    // GeoJSON with AQI per state
    const features = statesFC.features.map((f) => {
      const name = String((f.properties ?? {}).name ?? (f.properties ?? {}).NAME ?? "").trim();
      const code = STATE_NAME_TO_CODE[name] ?? null;
      const aqi = code ? aqiByState.get(code) : undefined;
      return { ...f, properties: { ...f.properties, aqi } };
    });
    const fc: FeatureCollection<Geometry, GeoJsonProperties & { aqi?: number }> = {
      type: "FeatureCollection",
      features,
    };

    const geoLayer = L.geoJSON(fc, {
      style: (feat) => ({
        fillColor: getAqiColor((feat as Feature<Geometry, { aqi?: number }>).properties?.aqi),
        weight: 1,
        opacity: 1,
        color: "#fff",
        dashArray: "3",
        fillOpacity: 0.7,
      }),
      onEachFeature: (feat, layer) => {
        const props = (feat as Feature<Geometry, { name?: string; NAME?: string; aqi?: number }>).properties ?? {};
        const stateName = String(props.name ?? props.NAME ?? "");

        layer.bindPopup(() => popup(stateName, props.aqi), { maxWidth: 280 });

        layer.on({
          mouseover: (e) => {
            const target = e.target as L.Path;
            target.setStyle({ weight: 3, color: "#666", dashArray: "", fillOpacity: 0.85 });
            target.bringToFront();
            updateInfo(stateName, props.aqi);
          },
          mouseout: (e) => {
            geoLayer.resetStyle(e.target as L.Path);
            updateInfo();
          },
        });
      },
    });
    geoLayer.addTo(map);
    geoLayerRef.current = geoLayer;

    // Legend (bottom-right)
    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "choropleth-info choropleth-legend");
      AQI_GRADES.forEach((lo, i) => {
        const hi = AQI_GRADES[i + 1];
        const color = getAqiColor(lo + 1);
        const label = hi != null ? `${lo}-${hi}` : `${lo}+`;
        div.innerHTML += `<i style="background:${color}"></i> ${label}<br/>`;
      });
      return div;
    };
    legend.addTo(map);
    legendRef.current = legend;

    return () => {
      if (geoLayerRef.current) map.removeLayer(geoLayerRef.current);
      if (infoRef.current) map.removeControl(infoRef.current);
      if (legendRef.current) map.removeControl(legendRef.current);
    };
  }, [statesFC, aqiByState, loading, map]);

  return null;
};

export default AirQualityHeatmap;
