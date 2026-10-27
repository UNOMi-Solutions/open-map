import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";

const getDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const getInvasiveSpeciesIcon = (localCount: number) => {
  const size =
    localCount < 3 ? 6 :
      localCount < 6 ? 11 :
        localCount < 12 ? 18 :
          28;

  const opacity = 0.7;

  return L.divIcon({
    className: "invasive-species-marker",
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: rgba(20, 184, 166, ${opacity});
      border-radius: 50%;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

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
  selectedYear: string;
};

const InvasiveSpeciesMarkers = ({
  setLoading,
  selectedYear,
}: InvasiveSpeciesMarkersProps) => {
  const [points, setPoints] = useState<InvasiveSpeciesPoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    const yearQuery =
      selectedYear === "all" ? "" : `?year=${selectedYear}`;

    cachedApiGet<InvasiveSpeciesResponse>(
      `environment:invasive-species-v2:${selectedYear}`,
      `/api/v1/environment/invasive-species${yearQuery}`,
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
  }, [selectedYear]);

  const filteredPoints = useMemo(() => {
    if (selectedYear === "all") {
      return points;
    }

    return points.filter(
      (point) => point.year === Number(selectedYear)
    );
  }, [points, selectedYear]);

  const localDensity = useMemo(() => {
    const density: Record<number, number> = {};

    filteredPoints.forEach((point) => {
      let nearbyCount = 0;

      filteredPoints.forEach((otherPoint) => {
        const distance = getDistanceKm(
          point.latitude,
          point.longitude,
          otherPoint.latitude,
          otherPoint.longitude
        );

        if (distance <= 75) {
          nearbyCount += 1;
        }
      });

      density[point.occurrenceId] = nearbyCount;
    });

    return density;
  }, [filteredPoints]);

  return (
    <>
      {filteredPoints.map((point) => (
        <Marker
          key={`invasive-${point.occurrenceId}`}
          position={[point.latitude, point.longitude]}
          icon={getInvasiveSpeciesIcon(
            localDensity[point.occurrenceId] || 1
          )}
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