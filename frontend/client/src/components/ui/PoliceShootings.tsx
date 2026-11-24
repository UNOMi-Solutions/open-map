import { useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import { CreatePulsingIcon } from "./CreateMarker";

type Incident = {
  locationData?: { latitude: number; longitude: number };
  "Date of Incident (month/day/year)"?: number | string;
  "Cause of death"?: string;
  "Media description of the circumstances surrounding the death"?: string;
  "Link to news article or photo of official document"?: string;
};

function toIncidentDate(value: Incident["Date of Incident (month/day/year)"]): Date | null {
  if (value == null || value === "") return null;
  const serial = Number(value);
  if (!Number.isFinite(serial)) return null;
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return Number.isFinite(date.getTime()) ? date : null;
}

export default function PoliceShootings({
  show,
  setLoading,
}: {
  show: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    setLoading(true);
    cachedApiGet<Incident[]>(
      "lawEnforcement:policeShootingVictimCases",
      "/api/v1/lawEnforcement/policeShootingVictimCases",
      CACHE_TTL.LAW_ENFORCEMENT,
    )
      .then((data) => {
        if (!cancelled) setIncidents(Array.isArray(data) ? data : []);
      })
      .catch((error) => console.error("[PoliceShootings] Fetch error:", error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, [show, setLoading]);

  if (!show) return null;

  return <>
    {incidents.map((incident, index) => {
      const lat = Number(incident.locationData?.latitude);
      const lng = Number(incident.locationData?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const date = toIncidentDate(incident["Date of Incident (month/day/year)"]);
      return (
        <Marker
          key={`${date?.toISOString() ?? "undated"}-${index}`}
          position={[lat, lng]}
          icon={CreatePulsingIcon("#dc2626")}
        >
          <Popup>
            <strong>Fatal police shooting</strong>
            {date && <div>{date.toLocaleDateString()}</div>}
            {incident["Cause of death"] && <div>Cause: {incident["Cause of death"]}</div>}
            {incident["Media description of the circumstances surrounding the death"] && (
              <p>{incident["Media description of the circumstances surrounding the death"]}</p>
            )}
            {incident["Link to news article or photo of official document"] && (
              <a href={incident["Link to news article or photo of official document"]} target="_blank" rel="noreferrer">
                Source report
              </a>
            )}
          </Popup>
        </Marker>
      );
    })}
  </>;
}
