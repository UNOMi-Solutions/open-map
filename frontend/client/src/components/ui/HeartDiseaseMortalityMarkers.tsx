import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import MarkerCompound from "./MarkerCompound";

type HeartDiseaseMortalityRow = {
  year?: string;
  locationabbr?: string;
  locationdesc?: string;
  data_value?: string | number;
  data_value_unit?: string;
  data_value_type?: string;
  locationid?: string;
  georeference?: {
    type?: string;
    coordinates?: number[];
  };
};

const HEART_DISEASE_ICON = L.divIcon({
  className: "heart-disease-mortality-marker",
  html: `<div style="
    width: 22px;
    height: 22px;
    background: #be123c;
    color: white;
    border: 2px solid white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.35);
  ">♥</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -13],
});

function getCoordinates(
  row: HeartDiseaseMortalityRow,
): [number, number] | null {
  const coordinates = row.georeference?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;

  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return [latitude, longitude];
}

type HeartDiseaseMortalityMarkersProps = {
  setLoading: (loading: boolean) => void;
};

const HeartDiseaseMortalityMarkers = ({
  setLoading,
}: HeartDiseaseMortalityMarkersProps) => {
  const [rows, setRows] = useState<HeartDiseaseMortalityRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    cachedApiGet<HeartDiseaseMortalityRow[]>(
      "health:heart-disease-mortality",
      "/api/v1/environment/heartDiseaseMortality",
      CACHE_TTL.ENVIRONMENT_GLOBAL,
    )
      .then((data) => {
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error("[HeartDiseaseMortalityMarkers] Fetch error:", error);
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingData(false);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const points = rows
    .map((row) => ({
      row,
      coordinates: getCoordinates(row),
      rate: Number(row.data_value),
    }))
    .filter(
      (
        point,
      ): point is {
        row: HeartDiseaseMortalityRow;
        coordinates: [number, number];
        rate: number;
      } => point.coordinates !== null && Number.isFinite(point.rate),
    );

  return (
    <MarkerCompound>
      {points.map(({ row, coordinates, rate }) => (
        <Marker
          key={`heart-disease-${row.locationid}`}
          position={coordinates}
          icon={HEART_DISEASE_ICON}
        >
          <Popup>
            {loadingData ? (
              "Loading..."
            ) : (
              <div className="min-w-0 max-w-[280px] break-words">
                <h3 className="text-base font-bold">
                  {row.locationdesc ?? "County"}
                  {row.locationabbr ? `, ${row.locationabbr}` : ""}
                </h3>
                <p>
                  <strong>Mortality rate:</strong>{" "}
                  {rate.toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })}{" "}
                  {row.data_value_unit ?? "per 100,000 population"}
                </p>
                <p>
                  Age-adjusted, spatially smoothed three-year average
                  (2019–2021); overall sex and race/ethnicity.
                </p>
              </div>
            )}
          </Popup>
        </Marker>
      ))}
    </MarkerCompound>
  );
};

export default HeartDiseaseMortalityMarkers;
