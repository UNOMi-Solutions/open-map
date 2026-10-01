import L from "@/lib/leafletGlobal";
import "leaflet.heat";
import { useMap } from "react-leaflet";
import { useEffect, useState, useRef, useMemo } from "react";
import { feature } from "topojson-client";
import * as turf from "@turf/turf";
import { cachedApiGetBatch, CACHE_TTL } from "@/lib/apiCache";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";

// 2-letter state codes for fetching; STATE_CODES maps them to FIPS prefix
const STATE_ABBREVS = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI",
  "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
  "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
  "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY",
] as const;

const STATE_CODES: Record<string, string> = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09",
  DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17",
  IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24",
  MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31",
  NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38",
  OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46",
  TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54",
  WI: "55", WY: "56",
};

const FIPS_TO_ABBREV: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_CODES).map(([abbrev, fips]) => [fips, abbrev]),
);

// Types to define county properties so can later map data to the county on the map
type County = { name: string };
type CountyFeature = Feature<Polygon | MultiPolygon, County>;

// Returned properties from natural disaster incidents api
type NaturalDisasterIncident = {
  id?: string;
  declarationTitle?: string;
  incidentType?: string;
  incidentBeginDate?: string;
  county?: string;
  [key: string]: unknown;
};

type NaturalDisasterIncidentMarkersProps = {
  selectedStateCode: string | null;
  selectedIncidentTypes?: string[];
  setLoading: (loading: boolean) => void;
};

// Removes unecessary words from the county name that was returned from the api
// Now can be matched to the county as it is formatted in the geojson file
function normalizeCountyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(county\)|\s*\(parish\)|\s*\(borough\)|\s*\(census area\)|\s*\(city and borough\)|\s*\(municipality\)/gi, "")
    .replace(/\s+(county|parish|borough|census area|city and borough|municipality)$/i, "")
    .trim();
}

// Show only date of incident in popup
function formatDate(dateStr: string | undefined): string {
  if (!dateStr || typeof dateStr !== "string") return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const HEAT_GRADIENT: Record<number, string> = {
  0.2: "#FED976",
  0.4: "#FEB24C",
  0.6: "#FD8D3C",
  0.8: "#E31A1C",
  1.0: "#800026",
};

// Using the 95th percentile as the heat ceiling keeps a few outlier counties from washing out the rest
function heatCeiling(counts: number[]): number {
  if (counts.length === 0) return 1;
  const sorted = [...counts].sort((a, b) => a - b);
  return Math.max(1, sorted[Math.floor(0.95 * (sorted.length - 1))]);
}

function Popup(countyName: string, stateAbbrev: string, incidents: NaturalDisasterIncident[]): string {
  const title = stateAbbrev ? `${countyName}, ${stateAbbrev}` : countyName;
  if (incidents.length === 0) {
    return `
      <div style="min-width:200px;max-width:320px;">
        <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">${title}</h3>
        <p style="font-size:13px;color:#888;">No incidents reported.</p>
      </div>`;
  }

  const listItems = incidents
    .map(
      (inc) => `
      <li style="border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-bottom:6px;">
        <p style="margin:0;font-weight:600;font-size:13px;">${String(inc.declarationTitle ?? "—")}</p>
        <p style="margin:2px 0 0;font-size:12px;"><strong>Type:</strong> ${String(inc.incidentType ?? "—")}</p>
        <p style="margin:2px 0 0;font-size:12px;"><strong>Date:</strong> ${formatDate(inc.incidentBeginDate)}</p>
      </li>`,
    )
    .join("");

  return `
    <div style="min-width:200px;max-width:320px;">
      <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">${title}</h3>
      <p style="margin:0 0 6px;font-size:13px;color:#555;">${incidents.length} incident${incidents.length === 1 ? "" : "s"}</p>
      <ul style="list-style:none;padding:0;margin:0;max-height:280px;overflow-y:auto;">
        ${listItems}
      </ul>
    </div>`;
}

const NaturalDisasterIncidentMarkers = ({
  selectedStateCode,
  selectedIncidentTypes = [],
  setLoading,
}: NaturalDisasterIncidentMarkersProps) => {
  const map = useMap(); // Leaflet map instance

  // Reference layers that can be removed when state changes
  // These references are the heat layer, the transparent county hit areas, info box in top right, and legend in bottom right
  const heatLayerRef = useRef<L.HeatLayer | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null); 
  const infoRef = useRef<L.Control | null>(null); 
  const legendRef = useRef<L.Control | null>(null); 

  // all county properties from geojson file
  const [allCountyFeatures, setAllCountyFeatures] = useState<CountyFeature[]>([]);

  // all incidents data from api
  const [incidentData, setIncidentData] = useState<NaturalDisasterIncident[]>([]);

  // Load county GeoJSON properties
  useEffect(() => {
    fetch("/geo/counties-10m.json")
      .then((response) => response.json())

      // Have to convert the json to a FeatureCollection (geographic features of the counties) so can be used with Leaflet
      .then((topo: Topology) => {
        const polyFeatures = feature(topo, topo.objects.counties as GeometryCollection<County>) as FeatureCollection<Polygon | MultiPolygon, County>;
        setAllCountyFeatures(polyFeatures.features as CountyFeature[]);
      })
      .catch((err) =>
        console.error("Failed to load counties:", err),
      );
  }, []);

  // Fetch incidents for all states (nationwide choropleth)
  useEffect(() => {
    let cancelled = false;
    setIncidentData([]);
    setLoading(true);

    const requests = STATE_ABBREVS.map((code) => ({
      cacheKey: `environment:naturalDisasters:${code}`,
      path: `/api/v1/environment/naturalDisasterIncidents?stateCode=${encodeURIComponent(code)}`,
    }));

    cachedApiGetBatch<Record<string, unknown>>(requests, CACHE_TTL.ENVIRONMENT_STATE)
      .then((results) => {
        if (cancelled) return;
        const combined = results.flatMap((data, index) => {
          const stateCode = STATE_ABBREVS[index];
          const list =
            data?.incidents ?? data?.naturalDisasterIncidents ?? data?.data ?? [];
          const arr = Array.isArray(list) ? list : [];
          return arr.map((inc: NaturalDisasterIncident) => ({
            ...inc,
            _stateCode: stateCode,
          }));
        });
        setIncidentData(combined);
      })
      .catch((error) => {
        console.error("[NaturalDisasterChoropleth] Fetch error:", error);
        if (!cancelled) setIncidentData([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredIncidents = useMemo(
    () =>
      selectedIncidentTypes.length > 0
        ? incidentData.filter((incident) =>
            selectedIncidentTypes.includes(
              String(incident.incidentType ?? "").trim(),
            ),
          )
        : incidentData,
    [incidentData, selectedIncidentTypes],
  );

  // Group incidents by "stateFips-normalizedCounty" (county names repeat across states)
  const incidentsByCounty = useMemo(() => {
    const grouped = new Map<string, NaturalDisasterIncident[]>();
    for (const incident of filteredIncidents) {
      if (!incident.county) continue;
      const stateCode = (incident as NaturalDisasterIncident & { _stateCode?: string })._stateCode;
      const fips = stateCode ? STATE_CODES[stateCode] : "";
      const key = fips ? `${fips}-${normalizeCountyName(String(incident.county))}` : normalizeCountyName(String(incident.county));
      const list = grouped.get(key) ?? [];
      list.push(incident);
      grouped.set(key, list);
    }
    return grouped;
  }, [filteredIncidents]);

  // Count incidents per county (keyed by stateFips-normalizedCounty)
  const countsByCounty = useMemo(() => {
    const counts = new Map<string, number>();
    incidentsByCounty.forEach((list, key) => {
      counts.set(key, list.length);
    });
    return counts;
  }, [incidentsByCounty]);

  // County centroids (keyed by stateFips-normalizedCounty) used as heat points
  const countyCentroids = useMemo(() => {
    const centroids = new Map<string, [number, number]>();
    for (const f of allCountyFeatures) {
      const fips = String(f.id ?? "").slice(0, 2);
      const key = `${fips}-${normalizeCountyName(f.properties?.name ?? "")}`;
      const [lng, lat] = turf.centroid(f).geometry.coordinates;
      centroids.set(key, [lat, lng]);
    }
    return centroids;
  }, [allCountyFeatures]);

  // Build heatmap layer
  useEffect(() => {
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    if (geoLayerRef.current) {
      map.removeLayer(geoLayerRef.current);
      geoLayerRef.current = null;
    }
    if (infoRef.current) {
      map.removeControl(infoRef.current);
      infoRef.current = null;
    }
    if (legendRef.current) {
      map.removeControl(legendRef.current);
      legendRef.current = null;
    }

    if ( allCountyFeatures.length === 0) return;

    // Info control (top-right hover panel)
    const info = new L.Control({ position: "topright" });
    info.onAdd = function () {
      const div = L.DomUtil.create("div", "choropleth-info");
      div.innerHTML = "<h4>Natural Disaster Incidents</h4>Hover over a county";
      return div;
    };
    const updateInfo = (label?: string, count?: number) => {
      const container = (info as unknown as { _container: HTMLElement })._container;
      if (!container) return;
      container.innerHTML =
        "<h4>Natural Disaster Incidents</h4>" +
        (label != null
          ? `<b>${label}</b><br/>${count ?? 0} incident${count === 1 ? "" : "s"}`
          : "Hover over a county");
    };
    info.addTo(map);
    infoRef.current = info;

    const heatPoints: Array<[number, number, number]> = [];
    countsByCounty.forEach((count, key) => {
      const centroid = countyCentroids.get(key);
      if (centroid && count > 0) heatPoints.push([centroid[0], centroid[1], count]);
    });
    const maxIntensity = heatCeiling(heatPoints.map((p) => p[2]));

    // leaflet.heat halves point intensity for each zoom level below maxZoom, offsetting how densely
    // packed small eastern counties pile up when zoomed out
    const heatLayer = L.heatLayer(heatPoints, {
      radius: 15,
      blur: 15,
      maxZoom: 9,
      max: maxIntensity,
      minOpacity: 0.3,
      gradient: HEAT_GRADIENT,
    });
    heatLayer.addTo(map);
    heatLayerRef.current = heatLayer;

    // Transparent county shapes on top of the heat layer for hover info and click popups
    const fc: FeatureCollection<
      Polygon | MultiPolygon,
      County & { incidentCount: number }
    > = {
      type: "FeatureCollection",
      features: allCountyFeatures.map((f) => {
        const name = f.properties?.name ?? "";
        const fips = String(f.id ?? "").slice(0, 2);
        const key = `${fips}-${normalizeCountyName(name)}`;
        const count = countsByCounty.get(key) ?? 0;
        return {
          ...f,
          properties: { ...f.properties, incidentCount: count },
        };
      }),
    };

    const geoLayer = L.geoJSON(fc, {
      style: () => ({
        weight: 0,
        opacity: 0,
        fillOpacity: 0,
      }),
      onEachFeature: (_feat, layer) => {
        const props = (
          _feat as Feature<
            Polygon | MultiPolygon,
            County & { incidentCount: number }
          >
        ).properties;

        const fips = String((_feat as Feature<Polygon | MultiPolygon, County>).id ?? "").slice(0, 2);
        const key = `${fips}-${normalizeCountyName(props.name)}`;
        const countyIncidents = incidentsByCounty.get(key) ?? [];
        const stateAbbrev = FIPS_TO_ABBREV[fips] ?? "";

        // Click → open popup with full incident details
        layer.bindPopup(() => Popup(props.name, stateAbbrev, countyIncidents), {
          maxWidth: 340,
          maxHeight: 350,
        });

        layer.on({
          mouseover: (e: L.LeafletMouseEvent) => {
            const target = e.target as L.Path;
            target.setStyle({
              weight: 2,
              opacity: 1,
              color: "#444",
            });
            const hoverLabel = stateAbbrev ? `${props.name}, ${stateAbbrev}` : props.name;
            updateInfo(hoverLabel, props.incidentCount);
          },
          mouseout: (e: L.LeafletMouseEvent) => {
            geoLayer.resetStyle(e.target as L.Path);
            updateInfo();
          },
        });
      },
    });

    geoLayer.addTo(map);
    geoLayerRef.current = geoLayer;

    // Legend control (bottom-right)
    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "choropleth-info heatmap-legend");
      const stops = Object.entries(HEAT_GRADIENT)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([stop, color]) => `${color} ${Number(stop) * 100}%`)
        .join(", ");
      div.innerHTML =
        "<h4>Incident density</h4>" +
        `<div class="heatmap-legend-bar" style="background:linear-gradient(to right, transparent 0%, ${stops})"></div>` +
        `<div class="heatmap-legend-labels"><span>Low</span><span>${maxIntensity}+ per county</span></div>`;
      return div;
    };
    legend.addTo(map);
    legendRef.current = legend;

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      if (geoLayerRef.current) {
        map.removeLayer(geoLayerRef.current);
        geoLayerRef.current = null;
      }
      if (infoRef.current) {
        map.removeControl(infoRef.current);
        infoRef.current = null;
      }
      if (legendRef.current) {
        map.removeControl(legendRef.current);
        legendRef.current = null;
      }
    };
  }, [allCountyFeatures, countyCentroids, countsByCounty, incidentsByCounty, map]);

  return null;
};

export default NaturalDisasterIncidentMarkers;
