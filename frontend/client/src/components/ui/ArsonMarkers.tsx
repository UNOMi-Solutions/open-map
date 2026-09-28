import { useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import { CreateMarker } from "./CreateMarker";
import DonutChart from "./DonutChart";

type StateCrimeData = Record<string, Record<string, number>>;

type ArsonApiResponse = {
  year: string;
  data: Record<string, StateCrimeData>;
};

type ArsonMarkersProps = {
  arrestCategory: string;
};

const US_STATE_CENTERS = [
  { state: "AL", latitude: 32.806671, longitude: -86.79113 },
  { state: "AK", latitude: 61.370716, longitude: -152.404419 },
  { state: "AZ", latitude: 34.274882, longitude: -111.660023 },
  { state: "AR", latitude: 34.799999, longitude: -92.199997 },
  { state: "CA", latitude: 37.271874, longitude: -119.270415 },
  { state: "CO", latitude: 38.998394, longitude: -105.547211 },
  { state: "CT", latitude: 41.599998, longitude: -72.699997 },
  { state: "DE", latitude: 39, longitude: -75.5 },
  { state: "FL", latitude: 27.994402, longitude: -81.760254 },
  { state: "GA", latitude: 32.75, longitude: -83.5 },
  { state: "HI", latitude: 20.9, longitude: -156.5 },
  { state: "ID", latitude: 44.35, longitude: -114.633333 },
  { state: "IL", latitude: 40, longitude: -89 },
  { state: "IN", latitude: 39.766667, longitude: -86.166667 },
  { state: "IA", latitude: 42, longitude: -93.5 },
  { state: "KS", latitude: 38.5, longitude: -98 },
  { state: "KY", latitude: 37.5, longitude: -85 },
  { state: "LA", latitude: 31, longitude: -92 },
  { state: "ME", latitude: 45.367584, longitude: -68.972168 },
  { state: "MD", latitude: 39, longitude: -76.75 },
  { state: "MA", latitude: 42.25, longitude: -71.5 },
  { state: "MI", latitude: 44.182205, longitude: -84.506836 },
  { state: "MN", latitude: 46.28, longitude: -94.305305 },
  { state: "MS", latitude: 32.767799, longitude: -89.681541 },
  { state: "MO", latitude: 38.573936, longitude: -92.60376 },
  { state: "MT", latitude: 46.96526, longitude: -110.53638 },
  { state: "NE", latitude: 41.5, longitude: -99.75 },
  { state: "NV", latitude: 39.876019, longitude: -117.224121 },
  { state: "NH", latitude: 44, longitude: -71.5 },
  { state: "NJ", latitude: 40.15, longitude: -74.666667 },
  { state: "NM", latitude: 34.5, longitude: -106 },
  { state: "NY", latitude: 43, longitude: -75 },
  { state: "NC", latitude: 35.5, longitude: -79.5 },
  { state: "ND", latitude: 47.45, longitude: -100.45 },
  { state: "OH", latitude: 40.367474, longitude: -82.996216 },
  { state: "OK", latitude: 35.5, longitude: -97.5 },
  { state: "OR", latitude: 44, longitude: -120.5 },
  { state: "PA", latitude: 41.203323, longitude: -77.194527 },
  { state: "RI", latitude: 41.700001, longitude: -71.5 },
  { state: "SC", latitude: 33.75, longitude: -80.5 },
  { state: "SD", latitude: 44.5, longitude: -100.35 },
  { state: "TN", latitude: 35.860119, longitude: -86.660156 },
  { state: "TX", latitude: 31, longitude: -100 },
  { state: "UT", latitude: 39.41922, longitude: -111.950684 },
  { state: "VT", latitude: 44, longitude: -72.699997 },
  { state: "VA", latitude: 37.5, longitude: -78.5 },
  { state: "WA", latitude: 47.400902, longitude: -120.5 },
  { state: "WV", latitude: 38.5, longitude: -80.5 },
  { state: "WI", latitude: 44, longitude: -89.5 },
  { state: "WY", latitude: 43, longitude: -107.5 },
];

const ARSON_ICON = CreateMarker("#dc2626");

export default function ArsonMarkers({ arrestCategory }: ArsonMarkersProps) {
  const [response, setResponse] = useState<ArsonApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    cachedApiGet<ArsonApiResponse>(
      "crime:arsonByState",
      "/api/v1/crime/arsonByState",
      CACHE_TTL.CRIME,
    )
      .then((data) => {
        if (!cancelled) setResponse(data);
      })
      .catch((fetchError: unknown) => {
        console.error("[ArsonMarkers] Fetch error:", fetchError);
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "An unknown error occurred.",
          );
        }
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
      {US_STATE_CENTERS.map(({ state, latitude, longitude }) => {
        const categoryData = response?.data?.[state]?.[arrestCategory] ?? {};

        return (
          <Marker
            key={state}
            position={[latitude, longitude]}
            icon={ARSON_ICON}
          >
            <Popup>
              <div className="min-w-0 max-w-[300px] text-sm text-[#0c1022]">
                <h2 className="text-base font-bold">
                  Arson arrests in {state} ({response?.year ?? "2023"})
                </h2>
                {loading ? (
                  <p>Loading arson data...</p>
                ) : error ? (
                  <p role="alert">Unable to load arson data: {error}</p>
                ) : Object.keys(categoryData).length > 0 ? (
                  <>
                    <h3 className="mt-1 text-center font-semibold">
                      {arrestCategory}
                    </h3>
                    <DonutChart data={categoryData} color={0} />
                  </>
                ) : (
                  <p>No data available for {arrestCategory}.</p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
