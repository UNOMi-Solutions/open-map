import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";

const INVASIVE_SPECIES_ICON = L.divIcon({
  className: "invasive-species-marker",
  html: `<div style="
    width: 24px;
    height: 24px;
    background: #16a34a;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

type InvasiveSpeciesPoint = {
  occurrenceId: number;
  speciesId: number;
  species: string;
  scientificName: string;
  group: string;
  latitude: number;
  longitude: number;
  state?: string;
  county?: string;
  locality?: string;
  date?: string;
  year?: number;
  status?: string;
  recordType?: string;
};

type InvasiveSpeciesResponse = {
  source: string;
  count: number;
  data: InvasiveSpeciesPoint[];
};

type InvasiveSpeciesMarkersProps = {
  setLoading: (loading: boolean) => void;
};

const InvasiveSpeciesMarkers = ({
  setLoading,
}: InvasiveSpeciesMarkersProps) => {
  const [points, setPoints] = useState<InvasiveSpeciesPoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    cachedApiGet<InvasiveSpeciesResponse>(
      "environment:invasive-species",
      "/api/v1/environment/invasive-species",
      CACHE_TTL.INVASIVE_SPECIES,
    )
      .then((response) => {
        if (!cancelled) {
          setPoints(response.data ?? []);
        }
      })
      .catch((err) => {
        console.error("[InvasiveSpeciesMarkers] Fetch error:", err);
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
      {points.map((point) => (
        <Marker
          key={`invasive-${point.occurrenceId}`}
          position={[point.latitude, point.longitude]}
          icon={INVASIVE_SPECIES_ICON}
        >
          <Popup>
            <div className="min-w-0 max-w-[280px] overflow-y-auto overflow-x-hidden break-words">
              <h3 className="text-base font-bold">{point.species}</h3>

              <p>
                <strong>Scientific name:</strong> {point.scientificName}
              </p>

              {point.state && (
                <p>
                  <strong>State:</strong> {point.state}
                </p>
              )}

              {point.county && (
                <p>
                  <strong>County:</strong> {point.county}
                </p>
              )}

              {point.locality && (
                <p>
                  <strong>Location:</strong> {point.locality}
                </p>
              )}

              {point.date && (
                <p>
                  <strong>Date:</strong> {point.date}
                </p>
              )}

              {point.status && (
                <p>
                  <strong>Status:</strong> {point.status}
                </p>
              )}

              {point.recordType && (
                <p>
                  <strong>Record type:</strong> {point.recordType}
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
};

export default InvasiveSpeciesMarkers;