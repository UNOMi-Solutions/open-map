import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import { US_STATE_CENTERS } from "@/lib/us-state-centers";
import { CreatePulsingIcon } from "./CreateMarker";
import DonutChart from "./DonutChart";

interface StateHomeInvasionData {
  robbery: number;
  burglary: number;
  total: number;
  reported: boolean;
}

interface HomeInvasionStateResponse {
  success: boolean;
  source: string;
  sourceUrl: string;
  year: number;
  provisional: boolean;
  definition: string;
  data: StateHomeInvasionData;
}

interface HomeInvasionMarkersProps {
  show: boolean;
  year: number;
}

const numberFormatter = new Intl.NumberFormat("en-US");

export default function HomeInvasionMarkers({
  show,
  year,
}: HomeInvasionMarkersProps) {
  const [stateData, setStateData] = useState<Record<string, StateHomeInvasionData>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [stateErrors, setStateErrors] = useState<Record<string, string>>({});
  const [metadata, setMetadata] = useState<Omit<HomeInvasionStateResponse, "data"> | null>(null);
  const activeYearRef = useRef(year);
  const icon = useMemo(() => CreatePulsingIcon("hsl(285,80%,50%)"), []);

  useEffect(() => {
    activeYearRef.current = year;
    setStateData({});
    setLoadingStates({});
    setStateErrors({});
    setMetadata(null);
  }, [year]);

  const loadState = useCallback((state: string) => {
    if (!show || stateData[state] || loadingStates[state]) return;
    const query = new URLSearchParams({
      year: String(year),
      state,
    });

    setLoadingStates((current) => ({ ...current, [state]: true }));
    setStateErrors((current) => {
      const next = { ...current };
      delete next[state];
      return next;
    });
    cachedApiGet<HomeInvasionStateResponse>(
      `crime:homeInvasions:${year}:${state}`,
      `/api/v1/crime/homeInvasionsByState?${query.toString()}`,
      CACHE_TTL.CRIME,
    )
      .then((data) => {
        if (activeYearRef.current !== year) return;
        setStateData((current) => ({ ...current, [state]: data.data }));
        const { data: _data, ...responseMetadata } = data;
        setMetadata(responseMetadata);
      })
      .catch((requestError) => {
        if (activeYearRef.current !== year) return;
        console.error("[HomeInvasionMarkers] Fetch error:", requestError);
        setStateErrors((current) => ({
          ...current,
          [state]: "Home invasion data is currently unavailable.",
        }));
      })
      .finally(() => {
        if (activeYearRef.current !== year) return;
        setLoadingStates((current) => ({ ...current, [state]: false }));
      });
  }, [loadingStates, show, stateData, year]);

  if (!show) return null;

  return (
    <>
      {US_STATE_CENTERS.map(({ state, latitude, longitude }) => {
        const data = stateData[state];
        const loading = loadingStates[state];
        const error = stateErrors[state];
        return (
          <Marker
            key={state}
            position={[latitude, longitude]}
            icon={icon}
            eventHandlers={{ popupopen: () => loadState(state) }}
          >
            <Popup>
              <div className="min-w-[210px] text-[#0c1022]">
                <h1 className="text-lg font-bold">Home Invasions in {state}</h1>
                <p className="mt-1 text-center text-sm font-semibold">
                  {year}{year === 2026 ? " YTD" : ""}
                </p>
                {loading && <p className="mt-3 text-center text-sm">Loading…</p>}
                {!loading && !error && data && (
                  <>
                    <DonutChart
                      data={{
                        "Residential robberies": data.robbery,
                        "Residential burglaries": data.burglary,
                      }}
                      color={285}
                    />
                    <p className="text-center text-xs font-semibold">
                      {numberFormatter.format(data.total)} total reported offenses
                    </p>
                  </>
                )}
                {!loading && !error && !data && (
                  <p className="mt-3 text-center text-sm">Select this marker to load data.</p>
                )}
                {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
                {metadata && (
                  <>
                    <p className="mt-3 text-[11px] leading-4 text-[#0c1022]/70">
                      {metadata.definition}
                    </p>
                    <a
                      className="mt-2 inline-block text-[11px] font-semibold text-[#312b7a] underline"
                      href={metadata.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Source: {metadata.source}
                    </a>
                  </>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
