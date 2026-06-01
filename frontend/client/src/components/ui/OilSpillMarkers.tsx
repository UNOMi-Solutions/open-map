import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";

// marker icon to distinguish oil spills from default blue markers
const OIL_SPILL_ICON = L.divIcon({
  className: "oil-spill-marker",
  html: `<div style="
    width: 28px;
    height: 28px;
    background: #0d9488;
    border: 2px solid #0f766e;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
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
const OilSpillMarkers = () => {
  const [oilSpillData, setOilSpillData] = useState<OilSpillIncident[]>([]);
  const [loadingOilSpillData, setLoadingOilSpillData] = useState<Boolean>(true);

  useEffect(() => {
    fetch("http://localhost:8000/api/v1/environment/oilSpills", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setOilSpillData(Array.isArray(data) ? data : []);
      })
      .catch(error => {
        console.error("[OilSpillMarkers] Fetch error:", error);
        setOilSpillData([]);
      })
      .finally(() => setLoadingOilSpillData(false));
  }, []);

  /* Attach coordinates to each incident and remove invalid ones;
   an array of objects with incident, index, and coordinates is 
   returned so it can be displayed on the map */
  const incidentsWithCoords = oilSpillData
    .map((incident, index) => ({ incident, index, coords: getCoords(incident) }))
    .filter((x): x is { incident: OilSpillIncident; index: number; coords: [number, number] } => x.coords !== null);

  return <>
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
  </>
};

export default OilSpillMarkers;