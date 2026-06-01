import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";

/* Orange marker icon to distinguish air quality from other markers */
const AIR_QUALITY_ICON = L.divIcon({
  className: "air-quality-marker",
  html: `<div style="
    width: 28px;
    height: 28px;
    background: #f59e0b;
    border: 2px solid #d97706;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

/* Returned properties from air quality api */
type AirQualityStation = {
  lat: number;
  lon: number;
  aqi?: number;
  category?: string;
  parameter?: string;
  reportingArea?: string;
  stateCode?: string;
  dateObserved?: string;
  [key: string]: unknown;
};

/** Major US cities to sample for air quality [lat, lon] - TESTING
 * Need to to grab long/lat coordinates to display every city 
 */
const AIR_QUALITY_CITIES: [number, number][] = [
  [33.7490, -84.3880],   // Atlanta
  [32.7767, -96.7970],   // Dallas
  [39.7392, -104.9903],  // Denver
  [29.7604, -95.3698],   // Houston
  [34.0522, -118.2437],  // Los Angeles
  [25.7617, -80.1918],   // Miami
  [44.9778, -93.2650],   // Minneapolis
  [40.7128, -74.0060],   // New York
  [41.8781, -87.6298],   // Chicago
  [33.4484, -112.0740],  // Phoenix
  [37.7749, -122.4194],  // San Francisco
  [47.6062, -122.3321],  // Seattle
  [38.9072, -77.0369],   // Washington DC
  [39.9612, -82.9988],   // Columbus
  [29.4241, -98.4936],   // San Antonio
  [32.7157, -117.1611],  // San Diego
  [39.2904, -76.6122],   // Baltimore
  [42.3601, -71.0589],   // Boston
  [36.1699, -115.1398],  // Las Vegas
];

function normalizeStation(obs: Record<string, unknown>, fallbackLat: number, fallbackLon: number): AirQualityStation | null {
  const lat = Number(obs.Latitude ?? obs.latitude ?? fallbackLat);
  const lon = Number(obs.Longitude ?? obs.longitude ?? fallbackLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const cat = obs.Category as Record<string, unknown> | undefined;
  const aqi = obs.AQI ?? obs.aqi;
  return {
    lat,
    lon,
    aqi: aqi != null ? Number(aqi) : undefined,
    category: (cat?.Name ?? obs.category ?? obs.Category) as string | undefined,
    parameter: (obs.ParameterName ?? obs.parameter) as string | undefined,
    reportingArea: (obs.ReportingArea ?? obs.reportingArea) as string | undefined,
    stateCode: (obs.StateCode ?? obs.stateCode) as string | undefined,
    dateObserved: (obs.DateObserved ?? obs.dateObserved) as string | undefined,
  };
}

const AirQualityMarkers = () => {
  const [stations, setStations] = useState<AirQualityStation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const baseUrl = "http://localhost:8000/api/v1/environment/airQualityByLocation";
    const seen = new Set<string>();

    Promise.all(
      AIR_QUALITY_CITIES.map(([lat, lon]) =>
        fetch(`${baseUrl}?lat=${lat}&long=${lon}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        })
          .then((res) => (res.ok ? res.json() : []))
          .then((data) => {
            const arr = Array.isArray(data) ? data : [];
            return arr.map((obs: Record<string, unknown>) => normalizeStation(obs, lat, lon));
          })
          .catch(() => [])
      )
    )
      .then((results) => {
        const all: AirQualityStation[] = [];
        for (const list of results) {
          for (const s of list) {
            if (!s) continue;
            const key = `${s.lat.toFixed(4)},${s.lon.toFixed(4)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            all.push(s);
          }
        }
        setStations(all);
      })
      .catch((err) => {
        console.error("[AirQualityMarkers] Fetch error:", err);
        setStations([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {stations.map((station, index) => (
        <Marker
          key={`aq-${station.lat}-${station.lon}-${index}`}
          position={[station.lat, station.lon]}
          icon={AIR_QUALITY_ICON}
        >
          {!loading ? (
            <Popup>
              <div className="min-w-0 max-w-[280px] overflow-y-auto overflow-x-hidden break-words">
                <h3 className="text-base font-bold">
                  {station.reportingArea ?? `Air Quality #${index + 1}`}
                </h3>
                {station.aqi != null && <p><strong>AQI:</strong> {station.aqi}</p>}
                {station.category && <p><strong>Category:</strong> {station.category}</p>}
                {station.parameter && <p><strong>Parameter:</strong> {station.parameter}</p>}
                {station.stateCode && <p><strong>State:</strong> {station.stateCode}</p>}
                {station.dateObserved && <p><strong>Date:</strong> {String(station.dateObserved)}</p>}
              </div>
            </Popup>
          ) : (
            <Popup>Loading...</Popup>
          )}
        </Marker>
      ))}
    </>
  );
};

export default AirQualityMarkers;
