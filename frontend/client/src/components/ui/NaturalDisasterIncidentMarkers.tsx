import L from "leaflet";
import { useMap } from "react-leaflet";
import { useEffect, useState, useRef, useMemo } from "react";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";

const apiURL = import.meta.env.VITE_API_LINK || "";
const apiKey = import.meta.env.VITE_API_DEV_KEY || "";

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

// Color gradient for incident count
function getColor(count: number): string {
  if (count >= 50) return "#800026";
  if (count >= 30) return "#BD0026";
  if (count >= 20) return "#E31A1C";
  if (count >= 10) return "#FC4E2A";
  if (count >= 5) return "#FD8D3C";
  if (count >= 2) return "#FEB24C";
  if (count >= 1) return "#FED976";
  return "#FFEDA0";
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

const GRADES = [0, 1, 2, 5, 10, 20, 30, 50];

const NaturalDisasterIncidentMarkers = ({
  selectedStateCode,
  selectedIncidentTypes = [],
}: NaturalDisasterIncidentMarkersProps) => {
  const map = useMap(); // Leaflet map instance

  // Reference layers that can be removed when state changes
  // These references are the counties, info box in top right, and legend in bottom right
  const geoLayerRef = useRef<L.GeoJSON | null>(null); 
  const infoRef = useRef<L.Control | null>(null); 
  const legendRef = useRef<L.Control | null>(null); 

  // all county properties from geojson file
  const [allCountyFeatures, setAllCountyFeatures] = useState<CountyFeature[]>([]);

  // all incidents data from api
  const [incidentData, setIncidentData] = useState<NaturalDisasterIncident[]>([]);

  const [loading, setLoading] = useState(false);

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
    setIncidentData([]);
    setLoading(true);

    const urls = STATE_ABBREVS.map(
      (code) =>
        `${apiURL}/api/v1/environment/naturalDisasterIncidents?stateCode=${encodeURIComponent(code)}`,
    );

    Promise.all(
      urls.map((url) =>
        fetch(url, {
          method: "GET",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey || "" },
        })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
          .then((data) => {
            const list = data?.incidents ?? data?.naturalDisasterIncidents ?? data?.data ?? [];
            const arr = Array.isArray(list) ? list : [];
            const stateCode = new URL(url).searchParams.get("stateCode") ?? "";
            return arr.map((inc: NaturalDisasterIncident) => ({ ...inc, _stateCode: stateCode }));
          })
          .catch(() => []),
      ),
    )
      .then((results) => {
        const combined = results.flat();
        setIncidentData(combined);
      })
      .catch((error) => {
        console.error("[NaturalDisasterChoropleth] Fetch error:", error);
        setIncidentData([]);
      })
      .finally(() => setLoading(false));
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

  // Build choropleth layer
  useEffect(() => {
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

    if (loading || allCountyFeatures.length === 0) return;

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

    // Build GeoJSON with incident counts for all US counties
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
      style: (feat) => {
        const count =
          (feat as Feature<Polygon | MultiPolygon, { incidentCount: number }>)
            .properties?.incidentCount ?? 0;
        return {
          fillColor: getColor(count),
          weight: 1,
          opacity: 1,
          color: "#fff",
          dashArray: "3",
          fillOpacity: 0.7,
        };
      },
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
              weight: 3,
              color: "#666",
              dashArray: "",
              fillOpacity: 0.85,
            });
            target.bringToFront();
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
      const div = L.DomUtil.create("div", "choropleth-info choropleth-legend");
      for (let i = 0; i < GRADES.length; i++) {
        div.innerHTML +=
          `<i style="background:${getColor(GRADES[i] + 1)}"></i> ` +
          GRADES[i] +
          (GRADES[i + 1] ? `&ndash;${GRADES[i + 1]}<br/>` : "+");
      }
      return div;
    };
    legend.addTo(map);
    legendRef.current = legend;

    return () => {
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
  }, [allCountyFeatures, countsByCounty, incidentsByCounty, filteredIncidents, loading, map]);

  return null;
};

export default NaturalDisasterIncidentMarkers;
