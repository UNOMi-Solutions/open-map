import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import {
  getTimelineDateRange,
  isDateInTimelineRange,
  type TimelineDateRange,
} from "@/lib/timeline";
import MarkerCompound from "./MarkerCompound";

type MassShooting = {
  id: number;
  location: string | null;
  address: string | null;
  venue: string | null;
  state: string | null;
  date: string | null;
  time: string | null;
  year: number | null;
  fatalities: number | null;
  injured: number | null;
  totalVictims: number | null;
  suspectsKilled: number | null;
  suspectsInjured: number | null;
  suspectsArrested: number | null;
  characteristics: string[];
  sources: string[];
  gvaUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinatesApproximate: boolean;
};

type MassShootingsResponse = {
  success: boolean;
  data: MassShooting[];
};

type MassShootingMarkersProps = {
  setLoading: (loading: boolean) => void;
  timelineRange: TimelineDateRange | null;
  onDateRangeChange: (datasetId: string, range: TimelineDateRange | null) => void;
};

const iconCache = new Map<number, L.DivIcon>();

/** Circle sized by total victims so the deadliest incidents stand out. */
function getIcon(totalVictims: number | null): L.DivIcon {
  const size = Math.round(Math.min(44, 14 + Math.sqrt(totalVictims ?? 0) * 3));
  let icon = iconCache.get(size);
  if (!icon) {
    icon = L.divIcon({
      className: "mass-shooting-marker",
      html: `<div style="
        width: ${size}px;
        height: ${size}px;
        background: rgba(220, 38, 38, 0.75);
        border: 2px solid #7f1d1d;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      "></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
    iconCache.set(size, icon);
  }
  return icon;
}

function toDate(incident: MassShooting): Date | null {
  return incident.date ? new Date(`${incident.date}T00:00:00Z`) : null;
}

const MassShootingMarkers = ({
  setLoading,
  timelineRange,
  onDateRangeChange,
}: MassShootingMarkersProps) => {
  const [incidents, setIncidents] = useState<MassShooting[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cachedApiGet<MassShootingsResponse>(
      "crime:massShootings:gva",
      "/api/v1/crime/massShootings",
      CACHE_TTL.CRIME,
    )
      .then((res) => {
        if (!cancelled) setIncidents(Array.isArray(res?.data) ? res.data : []);
      })
      .catch((error) => {
        console.error("[MassShootingMarkers] Fetch error:", error);
        if (!cancelled) setIncidents([]);
      })
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onDateRangeChange("mass-shootings", getTimelineDateRange(incidents.map(toDate)));
    return () => onDateRangeChange("mass-shootings", null);
  }, [incidents, onDateRangeChange]);

  const visible = useMemo(
    () =>
      incidents.filter(
        (incident) =>
          incident.latitude != null &&
          incident.longitude != null &&
          isDateInTimelineRange(toDate(incident), timelineRange),
      ),
    [incidents, timelineRange],
  );

  return (
    <MarkerCompound>
      {visible.map((incident) => (
        <Marker
          key={incident.id}
          position={[incident.latitude as number, incident.longitude as number]}
          icon={getIcon(incident.totalVictims)}
        >
          <Popup>
            <div className="min-w-0 max-w-[300px] max-h-[320px] overflow-y-auto overflow-x-hidden break-words">
              <h3 className="text-base font-bold">{incident.venue ?? incident.location ?? "Mass shooting"}</h3>
              {incident.location && <p><strong>Location:</strong> {incident.location}</p>}
              {incident.address && <p><strong>Address:</strong> {incident.address}</p>}
              {incident.date && (
                <p>
                  <strong>Date:</strong> {toDate(incident)?.toLocaleDateString(undefined, { timeZone: "UTC" })}
                  {incident.time && ` · ${incident.time}`}
                </p>
              )}
              <p>
                <strong>Victims killed:</strong> {incident.fatalities ?? "?"} · <strong>Injured:</strong> {incident.injured ?? "?"}
              </p>
              {!!(incident.suspectsKilled || incident.suspectsInjured || incident.suspectsArrested) && (
                <p>
                  <strong>Suspects:</strong>{" "}
                  {[
                    incident.suspectsKilled && `${incident.suspectsKilled} killed`,
                    incident.suspectsInjured && `${incident.suspectsInjured} injured`,
                    incident.suspectsArrested && `${incident.suspectsArrested} arrested`,
                  ].filter(Boolean).join(", ")}
                </p>
              )}
              {incident.characteristics.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-xs">
                  {incident.characteristics.map((c) => <li key={c}>{c}</li>)}
                </ul>
              )}
              {(incident.gvaUrl || incident.sources[0]) && (
                <p className="mt-1">
                  {incident.gvaUrl && (
                    <a href={incident.gvaUrl} target="_blank" rel="noopener noreferrer">GVA incident</a>
                  )}
                  {incident.gvaUrl && incident.sources[0] && " · "}
                  {incident.sources[0] && (
                    <a href={incident.sources[0]} target="_blank" rel="noopener noreferrer">News source</a>
                  )}
                </p>
              )}
              {incident.coordinatesApproximate && (
                <p className="mt-1 text-xs text-gray-500">Location shown at city center.</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MarkerCompound>
  );
};

export default MassShootingMarkers;
