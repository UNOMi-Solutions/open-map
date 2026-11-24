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

const getInvasiveInsectIcon = (localCount: number) => {
  const size =
    localCount < 3 ? 6 :
      localCount < 6 ? 11 :
        localCount < 12 ? 18 :
          28;

  const opacity = 0.7;

  return L.divIcon({
    className: "invasive-insect-marker",
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: rgba(249, 115, 22, ${opacity});
      border-radius: 50%;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

type InvasiveInsectPoint = {
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

type InvasiveInsectResponse = {
  source: string;
  category: string;
  count: number;
  data: InvasiveInsectPoint[];
};

type InvasiveInsectMarkersProps = {
  setLoading: (loading: boolean) => void;
  selectedYear: string;
};

const InvasiveInsectMarkers = ({
  setLoading,
  selectedYear,
}: InvasiveInsectMarkersProps) => {
  const [points, setPoints] = useState<InvasiveInsectPoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    const yearQuery =
      selectedYear === "all" ? "" : `?year=${selectedYear}`;

    setLoading(true);

    cachedApiGet<InvasiveInsectResponse>(
      `environment:invasive-insects:${selectedYear}`,
      `/api/v1/environment/invasive-insects${yearQuery}`,
      CACHE_TTL.INVASIVE_SPECIES
    )
      .then((response) => {
        if (!cancelled) {
          setPoints(response.data || []);
        }
      })
      .catch((error) => {
        console.error("Failed to load invasive insects:", error);

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
          key={point.occurrenceId}
          position={[point.latitude, point.longitude]}
          icon={getInvasiveInsectIcon(
            localDensity[point.occurrenceId] || 1
          )}
        >
          <Popup>
            <div>
              <strong>{point.species}</strong>

              <div>
                <strong>Category:</strong> Insects
              </div>

              {point.scientificName && (
                <div>
                  <strong>Scientific name:</strong>{" "}
                  {point.scientificName}
                </div>
              )}

              {point.state && (
                <div>
                  <strong>State:</strong> {point.state}
                </div>
              )}

              {point.county && (
                <div>
                  <strong>County:</strong> {point.county}
                </div>
              )}

              {point.date && (
                <div>
                  <strong>Date:</strong> {point.date}
                </div>
              )}

              {point.status && (
                <div>
                  <strong>Status:</strong> {point.status}
                </div>
              )}

              <div>
                <strong>Source:</strong> EDDMapS
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
};

export default InvasiveInsectMarkers;