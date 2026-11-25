import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";

const getGroundwaterIcon = (depth: number) => {
  const safeDepth = Number.isFinite(depth) ? Math.abs(depth) : 0;

  const size =
    safeDepth < 25 ? 14 :
      safeDepth < 100 ? 20 :
        safeDepth < 250 ? 28 :
          36;

  const opacity =
    safeDepth < 25 ? 0.45 :
      safeDepth < 100 ? 0.6 :
        safeDepth < 250 ? 0.75 :
          0.9;

  return L.divIcon({
    className: "groundwater-marker",
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: rgba(59, 130, 246, ${opacity});
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: ${size >= 28 ?11 : 9}px;
      font-weight: 600;
      line-height: 1;
    ">
      ${Math.round(safeDepth)}
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

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
  selectedYear: string;
};

const GroundwaterMarkers = ({ setLoading, selectedYear, }: GroundwaterMarkersProps) => {
  const [points, setPoints] = useState<GroundwaterPoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    const yearQuery =
      selectedYear === "all" ? "" : `?year=${selectedYear}`;

    cachedApiGet<GroundwaterResponse>(
      `environment:groundwater-v4:${selectedYear}`,
      `/api/v1/environment/groundwater${yearQuery}`,
      CACHE_TTL.GROUNDWATER
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
  }, [selectedYear, setLoading]);

  return (
    <>
      {points.map((point, index) => (
        <Marker
          key={`groundwater-${point.siteId}-${index}`}
          position={[point.latitude, point.longitude]}
          icon={getGroundwaterIcon(point.depth)}
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