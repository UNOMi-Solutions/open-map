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
  name: string;
  location: string | null;
  state: string | null;
  date: string | null;
  year: number | null;
  fatalities: number | null;
  injured: number | null;
  totalVictims: number | null;
  venue: string | null;
  summary: string | null;
  shooterAge: string | null;
  shooterGender: string | null;
  weaponType: string | null;
  weaponsObtainedLegally: string | null;
  sources: string[];
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
      "crime:massShootings",
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
      {visible.map((incident, index) => (
        <Marker
          key={`${incident.name}-${incident.date ?? index}`}
          position={[incident.latitude as number, incident.longitude as number]}
          icon={getIcon(incident.totalVictims)}
        >
          <Popup>
            <div className="min-w-0 max-w-[300px] max-h-[320px] overflow-y-auto overflow-x-hidden break-words">
              <h3 className="text-base font-bold">{incident.name}</h3>
              {incident.location && <p><strong>Location:</strong> {incident.location}</p>}
              {incident.date && (
                <p><strong>Date:</strong> {toDate(incident)?.toLocaleDateString(undefined, { timeZone: "UTC" })}</p>
              )}
              <p>
                <strong>Killed:</strong> {incident.fatalities ?? "?"} · <strong>Injured:</strong> {incident.injured ?? "?"}
              </p>
              {incident.venue && <p><strong>Venue:</strong> {incident.venue}</p>}
              {incident.weaponType && <p><strong>Weapon:</strong> {incident.weaponType}</p>}
              {incident.weaponsObtainedLegally && (
                <p><strong>Obtained legally:</strong> {incident.weaponsObtainedLegally}</p>
              )}
              {incident.summary && <p className="mt-1">{incident.summary}</p>}
              {incident.sources[0] && (
                <p className="mt-1">
                  <a href={incident.sources[0]} target="_blank" rel="noopener noreferrer">Source</a>
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
