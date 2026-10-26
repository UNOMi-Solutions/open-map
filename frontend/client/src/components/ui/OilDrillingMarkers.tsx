import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import MarkerCompound from "./MarkerCompound";

const OIL_DRILLING_ICON = L.divIcon({
  className: "oil-drilling-marker",
  html: `<div style="
    width: 12px;
    height: 12px;
    background: #b45309;
    border: 2px solid #78350f;
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -6],
});

type OilDrillingFeature = {
  geometry?: {
    coordinates?: unknown;
  };
  properties?: Record<string, unknown>;
};

type OilDrillingResponse = {
  features?: OilDrillingFeature[];
};

function getCoords(feature: OilDrillingFeature): [number, number] | null {
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return [latitude, longitude];
}

type OilDrillingMarkersProps = {
  setLoading: (loading: boolean) => void;
};

const OilDrillingMarkers = ({ setLoading }: OilDrillingMarkersProps) => {
  const [wells, setWells] = useState<OilDrillingFeature[]>([]);
  const [loadingWells, setLoadingWells] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    cachedApiGet<OilDrillingResponse>(
      "environment:oilDrillingLocations",
      "/api/v1/environment/oilDrillingLocations",
      CACHE_TTL.ENVIRONMENT_GLOBAL,
    )
      .then((data) => {
        if (!cancelled) {
          setWells(Array.isArray(data?.features) ? data.features : []);
        }
      })
      .catch((error) => {
        console.error("[OilDrillingMarkers] Fetch error:", error);
        if (!cancelled) setWells([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingWells(false);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [setLoading]);

  return (
    <MarkerCompound>
      {wells.map((well, index) => {
        const coords = getCoords(well);
        if (!coords) return null;

        const properties = well.properties ?? {};
        const title = String(
          properties.WELL_NAME ?? properties.API_NUMBER ?? `Well #${index + 1}`,
        ).trim();

        return (
          <Marker
            key={String(properties.OBJECTID ?? properties.API_NUMBER ?? index)}
            position={coords}
            icon={OIL_DRILLING_ICON}
          >
            {!loadingWells && (
              <Popup>
                <div className="min-w-0 max-w-[280px] overflow-y-auto overflow-x-hidden break-words">
                  <h3 className="text-base font-bold">{title}</h3>
                  {properties.API_NUMBER != null && (
                    <p><strong>API number:</strong> {String(properties.API_NUMBER)}</p>
                  )}
                  {properties.OPERATOR != null && (
                    <p><strong>Operator code:</strong> {String(properties.OPERATOR)}</p>
                  )}
                  {properties.SPUD_DATE != null && (
                    <p><strong>Spud date:</strong> {String(properties.SPUD_DATE)}</p>
                  )}
                  {properties.TYPE_CODE_DESC != null && (
                    <p><strong>Well type:</strong> {String(properties.TYPE_CODE_DESC)}</p>
                  )}
                  {properties.STATUS_DESCRIPTION != null && (
                    <p><strong>Status:</strong> {String(properties.STATUS_DESCRIPTION)}</p>
                  )}
                  {properties.DEPTH != null && (
                    <p><strong>Depth:</strong> {String(properties.DEPTH)}</p>
                  )}
                </div>
              </Popup>
            )}
          </Marker>
        );
      })}
    </MarkerCompound>
  );
};

export default OilDrillingMarkers;
