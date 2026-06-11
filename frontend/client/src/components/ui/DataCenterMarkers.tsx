import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";

// Cyan/blue marker icon to distinguish data centers from other markers
const DATA_CENTER_ICON = L.divIcon({
  className: "data-center-marker",
  html: `<div style="
    width: 28px;
    height: 28px;
    background: #0891b2;
    border: 2px solid #0e7490;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

// Returned properties from data centers api
type DataCenter = {
  id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lon?: number;
  address?: string;
  city?: string;
  state?: string;
  capacity?: string | number;
  operator?: string;
  squareFootage?: string | number;
  square_feet?: string | number;
  sqft?: string | number;
  type?: string;
  dataCenterType?: string;
  facilityType?: string;
  [key: string]: unknown;
};

// Get coordinates from data center object
function getCoords(center: DataCenter): [number, number] | null {
  const lat = Number(center.latitude ?? center.lat);
  const lon = Number(center.longitude ?? center.lon);
  if (
    typeof lat !== "number" ||
    typeof lon !== "number"
  ) {
    return null;
  }
  return [lat, lon];
}

// Format square footage to display in popup
function formatValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

const DataCenterMarkers = () => {
  const [data, setData] = useState<DataCenter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    cachedApiGet<{ dataCenters?: DataCenter[] }>(
      "environment:dataCenters",
      "/api/v1/environment/dataCenters",
      CACHE_TTL.ENVIRONMENT_GLOBAL,
    )
      .then((raw) => {
        if (!cancelled) setData(raw?.dataCenters ?? []);
      })
      .catch((error) => {
        console.error("[DataCenterMarkers] Fetch error:", error);
        if (!cancelled) setData([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Attach coordinates to each data center and remove invalid ones
  const centersWithCoords = data.flatMap((center, index) => {
    const coords = getCoords(center);
    return coords ? [{ center, index, coords }] : [];
  });

  // Display markers and popups for data centers
  return (
    <>
      {centersWithCoords.map(({ center, index, coords: [lat, lng] }) => {
        const title =
          center.name ?? center.address ?? `Data Center #${index + 1}`;
        return (
          <Marker
            key={center.id ?? `dc-${index}`}
            position={[lat, lng]}
            icon={DATA_CENTER_ICON}
          >
            {!loading ? (
              <Popup>
                <div className="min-w-0 max-w-[320px] break-words overflow-y-auto overflow-x-hidden">
                  <h3 className="text-base font-bold">{title}</h3>
                  <ul className="mt-2 space-y-1 list-none pl-0 text-sm">
                    {center.name && (
                      <li>
                        <strong>Name:</strong> {String(center.name)}
                      </li>
                    )}
                    {center.address && (
                      <li>
                        <strong>Address:</strong> {String(center.address)}
                      </li>
                    )}
                    {(center.city ?? center.state) && (
                      <li>
                        <strong>Location:</strong>{" "}
                        {[center.city, center.state].filter(Boolean).join(", ")}
                      </li>
                    )}
                    {center.operator && (
                      <li>
                        <strong>Operator:</strong> {String(center.operator)}
                      </li>
                    )}
                    {center.capacity != null && (
                      <li>
                        <strong>Capacity:</strong> {formatValue(center.capacity)}
                      </li>
                    )}
                    {(center.sqft) != null && (
                      <li>
                        <strong>Square Footage:</strong>{" "}
                        {formatValue(
                          center.sqft
                        )}
                      </li>
                    )}
                    {(center.type) && (
                      <li>
                        <strong>Type:</strong>{" "}
                        {String(
                          center.type
                        )}
                      </li>
                    )}
                  </ul>
                </div>
              </Popup>
            ) : (
              <Popup>Loading...</Popup>
            )}
          </Marker>
        );
      })}
    </>
  );
};

export default DataCenterMarkers;
