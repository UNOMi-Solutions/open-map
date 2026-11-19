import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import {
  getTimelineDateRange,
  isDateInTimelineRange,
  type TimelineDateRange,
} from "@/lib/timeline";
import MarkerCompound from "./MarkerCompound";

// Translucent marker icon for oil spills.
const OIL_SPILL_ICON = L.divIcon({
  className: "oil-spill-marker",
  html: `<div style="width:100%;height:100%;border-radius:50%;background:rgba(0,0,0,0.45);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -7],
});

// Returned properties from oil spill api 
type OilSpillIncident = {
  id?: string;
  lat?: number;
  lon?: number;
  name?: string;
  location?: string;
  open_date?: string;
  threat?: string;
  threat_type?: string;
  commodity?: string;
  description?: string;
  [key: string]: unknown;
};

// get coordinates from specific incident and verify they are valid 
function getCoords(incident: OilSpillIncident): [number, number] | null {
  const lat = Number(incident.lat);
  const lon =  Number(incident.lon);
  if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  return [lat, lon];
}

// Fetch oil spill data from api and set state 
type OilSpillMarkersProps = {
  setLoading: (loading: boolean) => void;
  timelineRange: TimelineDateRange | null;
  onDateRangeChange: (datasetId: string, range: TimelineDateRange | null) => void;
};

const OilSpillMarkers = ({
  setLoading,
  timelineRange,
  onDateRangeChange,
}: OilSpillMarkersProps) => {
  const [oilSpillData, setOilSpillData] = useState<OilSpillIncident[]>([]);
  const [loadingOilSpillData, setLoadingOilSpillData] = useState<Boolean>(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cachedApiGet<OilSpillIncident[]>(
      "environment:oilSpills",
      "/api/v1/environment/oilSpills",
      CACHE_TTL.ENVIRONMENT_GLOBAL,
    )
      .then((data) => {
        if (!cancelled) setOilSpillData(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error("[OilSpillMarkers] Fetch error:", error);
        if (!cancelled) setOilSpillData([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingOilSpillData(false);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onDateRangeChange(
      "oil-spills",
      getTimelineDateRange(
        oilSpillData.map((incident) =>
          incident.open_date ? new Date(incident.open_date) : null,
        ),
      ),
    );
    return () => onDateRangeChange("oil-spills", null);
  }, [oilSpillData, onDateRangeChange]);

  /* Attach coordinates to each incident and remove invalid ones;
   an array of objects with incident, index, and coordinates is 
   returned so it can be displayed on the map */
  const incidentsWithCoords = oilSpillData
    .map((incident, index) => ({ incident, index, coords: getCoords(incident) }))
    .filter(
      (x): x is { incident: OilSpillIncident; index: number; coords: [number, number] } =>
        x.coords !== null &&
        isDateInTimelineRange(
          x.incident.open_date ? new Date(x.incident.open_date) : null,
          timelineRange,
        ),
    );

  return (<MarkerCompound maxClusterRadius="40">
    {
      incidentsWithCoords.map(({ incident, index, coords: [lat, lng] }) => {
        const title = incident.name ?? incident.location ?? `Oil spill #${index + 1}`;
        return (
          <Marker key={incident.id ?? `oil-${index}`} position={[lat, lng]} icon={OIL_SPILL_ICON}>
            {
              (!loadingOilSpillData) ?
                <Popup>
                  <div className="min-w-0 max-w-[280px] overflow-y-auto overflow-x-hidden break-words">
                    <h3 className="text-base font-bold">{title}</h3>
                    {incident.location && (
                      <p><strong>Location:</strong> {String(incident.location)}</p>
                    )}
                    {incident.open_date && <p><strong>Date:</strong> {String(incident.open_date)}</p>}
                    {(incident.threat ?? incident.threat_type) && <p><strong>Threat:</strong> {String(incident.threat ?? incident.threat_type)}</p>}
                    {incident.commodity && <p><strong>Commodity:</strong> {String(incident.commodity)}</p>}
                    {incident.description && <p><strong>Description:</strong> {String(incident.description)}</p>}
                  </div>
                </Popup>
                : <Popup>Loading...</Popup>
            }
          </Marker>
        );
      })
    }
  </MarkerCompound>
  );
};

export default OilSpillMarkers;