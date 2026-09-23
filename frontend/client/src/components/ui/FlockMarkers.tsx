import { useEffect, useState } from "react";
import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";

/** Green marker icon for waste treatment/disposal sites */
const FLOCK_CAMERA_ICON = L.divIcon({
  className: "flock-camera-marker",
  html: `<div style="
    width: 28px;
    height: 28px;
    background: #22c55e;
    border: 2px solid #16a34a;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

/** Parsed camera from API (GeoJSON Feature or plain object) */
type FlockCamera = {
  id: string;
  lat: number;
  lon: number;
  name: string;
  facilityType: string;
  address?: string;
  city?: string;
  county?: string;
  state?: string;
  status?: string;
};

/** Extract coordinates from GeoJSON geometry or plain object */
function getCoordsFromFeature(feature: Record<string, unknown>): [number, number] | null {
  // GeoJSON: geometry.coordinates is [lng, lat] for Point
  const geom = feature.geometry as { coordinates?: number[] } | undefined;
  if (geom?.coordinates && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
    const [lng, lat] = geom.coordinates;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  }

  // Plain object
  const props = (feature.properties ?? {}) as Record<string, unknown>;
  const lat = Number(feature.lat ?? feature.latitude ?? props.latitude);
  const lon = Number(feature.lon ?? feature.longitude ?? props.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];

  return null;
}

type FlockCameraMarkersProps = {
  setLoading: (loading: boolean) => void;
};

const FlockCameraMarkers = ({ setLoading }: FlockCameraMarkersProps) => {
  const [siteData, setSiteData] = useState<FlockCamera[]>([]);

  useEffect(() => {
    setSiteData([]);
    setLoading(true);

    let cancelled = false;
    const path = `/api/v1/flock/test`;

    cachedApiGet<unknown>(
      `flock:test`,
      path,
      CACHE_TTL.ENVIRONMENT_STATE,
    )
        .then((data) => {
            if (cancelled) return;
            console.log(data);
            setLoading(false);
        })
    /*
      .then((data) => {
        if (cancelled) return;
        let rawList: unknown[] = [];
        if (Array.isArray(data)) {
          rawList = data;
        } else if (
          data &&
          typeof data === "object" &&
          Array.isArray((data as Record<string, unknown>).features)
        ) {
          rawList = (data as { features: unknown[] }).features;
        } else if (
          data &&
          typeof data === "object" &&
          Array.isArray((data as Record<string, unknown>).sites)
        ) {
          rawList = (data as { sites: unknown[] }).sites;
        } else if (
          data &&
          typeof data === "object" &&
          Array.isArray((data as Record<string, unknown>).facilities)
        ) {
          rawList = (data as { facilities: unknown[] }).facilities;
        } else if (
          data &&
          typeof data === "object" &&
          Array.isArray((data as Record<string, unknown>).data)
        ) {
          rawList = (data as { data: unknown[] }).data;
        }

        const parsed: FlockCamera[] = [];
        rawList.forEach((f, index) => {
          const item = f as Record<string, unknown>;
          const lat = Number(item.latitude ?? item.lat);
          const lon = Number(item.longitude ?? item.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            const coords = getCoordsFromFeature(item);
            if (!coords) return;
            const [la, lo] = coords;
            //parsed.push(normalizeFacility(item, index, la, lo));
            return;
          }
          //parsed.push(normalizeFacility(item, index, lat, lon));
        });
        setSiteData(parsed);
      })
        */
      .catch((error) => {
        console.error("[FlockCameraMarkers] Fetch error:", error);
        if (!cancelled) setSiteData([]);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {siteData.map((site) => (
        <Marker key={site.id} position={[site.lat, site.lon]} icon={FLOCK_CAMERA_ICON}>
          {(
            <Popup>
              <div className="min-w-0 max-w-[280px] overflow-y-auto overflow-x-hidden break-words">
              
              </div>
            </Popup>
          )}
        </Marker>
      ))}
    </>
  );
};

export default FlockCameraMarkers;