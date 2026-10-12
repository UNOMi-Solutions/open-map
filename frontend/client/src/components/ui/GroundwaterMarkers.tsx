import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";

const GROUNDWATER_ICON = L.divIcon({
  className: "groundwater-marker",
  html: `<div style="
    width: 24px;
    height: 24px;
    background: #3b82f6;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

type GroundwaterPoint = {
  siteId: string;
  latitude: number;
  longitude: number;
  depth: number;
  unit: string;
  measurementDate: string;
  approvalStatus?: string;
};

type GroundwaterResponse = {
  source: string;
  parameterCode: string;
  description: string;
  count: number;
  data: GroundwaterPoint[];
};

type GroundwaterMarkersProps = {
  setLoading: (loading: boolean) => void;
};

const GroundwaterMarkers = ({ setLoading }: GroundwaterMarkersProps) => {
  const [points, setPoints] = useState<GroundwaterPoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    cachedApiGet<GroundwaterResponse>(
      "environment:groundwater",
      "/api/v1/environment/groundwater",
      CACHE_TTL.GROUNDWATER,
    )
      .then((response) => {
        if (!cancelled) {
          setPoints(response.data ?? []);
        }
      })
      .catch((err) => {
        console.error("[GroundwaterMarkers] Fetch error:", err);
        if (!cancelled) setPoints([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {points.map((point, index) => (
        <Marker
          key={`groundwater-${point.siteId}-${index}`}
          position={[point.latitude, point.longitude]}
          icon={GROUNDWATER_ICON}
        >
          <Popup>
            <div className="min-w-0 max-w-[280px] overflow-y-auto overflow-x-hidden break-words">
              <h3 className="text-base font-bold">Groundwater Level</h3>
              <p>
                <strong>Depth:</strong> {point.depth} {point.unit}
              </p>
              <p>
                <strong>Date:</strong> {point.measurementDate}
              </p>
              <p>
                <strong>Site:</strong> {point.siteId}
              </p>
              {point.approvalStatus && (
                <p>
                  <strong>Status:</strong> {point.approvalStatus}
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
};

export default GroundwaterMarkers;