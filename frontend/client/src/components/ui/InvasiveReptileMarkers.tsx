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

const getInvasiveReptileIcon = (localCount: number) => {
  const size =
    localCount < 3 ? 6 :
      localCount < 6 ? 11 :
        localCount < 12 ? 18 :
          28;

  const opacity = 0.7;

  return L.divIcon({
    className: "invasive-reptile-marker",
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: rgba(147, 51, 234, ${opacity});
      border-radius: 50%;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

type InvasiveReptilePoint = {
  occurrenceId: number;
  category: string;
  species: string;
  scientificName: string;
  latitude: number;
  longitude: number;
  state?: string;
  county?: string;
  date?: string;
  year?: number;
  status?: string;
};

type InvasiveReptileResponse = {
  source: string;
  category: string;
  count: number;
  data: InvasiveReptilePoint[];
};

type InvasiveReptileMarkersProps = {
  setLoading: (loading: boolean) => void;
  selectedYear: string;
};

const InvasiveReptileMarkers = ({
  setLoading,
  selectedYear,
}: InvasiveReptileMarkersProps) => {
  const [points, setPoints] = useState<InvasiveReptilePoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    const yearQuery =
      selectedYear === "all" ? "" : `?year=${selectedYear}`;

    setLoading(true);

    cachedApiGet<InvasiveReptileResponse>(
      `environment:invasive-reptiles:${selectedYear}`,
      `/api/v1/environment/invasive-reptiles${yearQuery}`,
      CACHE_TTL.INVASIVE_SPECIES
    )
      .then((response) => {
        if (!cancelled) {
          setPoints(response.data ?? []);
        }
      })
      .catch((error) => {
        console.error("Failed to load invasive reptiles:", error);

        if (!cancelled) {
          setPoints([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedYear, setLoading]);

  const localDensity = useMemo(() => {
    const density: Record<number, number> = {};

    points.forEach((point) => {
      let nearbyCount = 0;

      points.forEach((otherPoint) => {
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
  }, [points]);

  return (
    <>
      {points.map((point) => (
        <Marker
          key={`invasive-reptile-${point.occurrenceId}`}
          position={[point.latitude, point.longitude]}
          icon={getInvasiveReptileIcon(
            localDensity[point.occurrenceId] || 1
          )}
        >
          <Popup>
            <div className="min-w-0 max-w-[280px] overflow-y-auto overflow-x-hidden break-words">
              <h3 className="text-base font-bold">{point.species}</h3>

              <p>
                <strong>Category:</strong> Reptiles
              </p>

              {point.scientificName && (
                <p>
                  <strong>Scientific name:</strong>{" "}
                  {point.scientificName}
                </p>
              )}

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

              <p>
                <strong>Source:</strong> EDDMapS
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
};

export default InvasiveReptileMarkers;