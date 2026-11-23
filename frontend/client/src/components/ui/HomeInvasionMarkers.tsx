import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, Marker, Pane, Popup } from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection, Geometry, GeoJsonProperties } from "geojson";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import { US_STATE_CENTERS } from "@/lib/us-state-centers";
import { FIPS_TO_STATE } from "@/lib/fips-to-state";
import { homeInvasionFill } from "@/lib/datapoint-map-style";
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
  states: FeatureCollection<Geometry, GeoJsonProperties> | null;
  pinDropMode: boolean;
}

const numberFormatter = new Intl.NumberFormat("en-US");
const sourceUrl = "https://cde.ucr.cjis.gov/";

export default function HomeInvasionMarkers({
  show,
  year,
  states,
  pinDropMode,
}: HomeInvasionMarkersProps) {
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [stateData, setStateData] = useState<Record<string, StateHomeInvasionData>>({});
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [stateErrors, setStateErrors] = useState<Record<string, string>>({});
  const [metadata, setMetadata] = useState<Omit<HomeInvasionStateResponse, "data"> | null>(null);
  const activeYearRef = useRef(year);
  const generationRef = useRef(0);
  const loadedStatesRef = useRef(new Set<string>());
  const pendingRequestsRef = useRef(new Map<string, Promise<boolean>>());
  // Non-interactive labels keep the full state polygon as the click target.
  const icons = useMemo(() => Object.fromEntries(US_STATE_CENTERS.map(({ state }) => {
    const data = stateData[state];
    const label = data?.reported ? numberFormatter.format(data.total) : stateErrors[state] ? "N/A" : data ? "N/A" : "…";
    return [state, L.divIcon({ className: "home-invasion-count", html: `<span>${label}</span>`, iconSize: [72, 24], iconAnchor: [36, 12] })];
  })), [stateData, stateErrors]);

  useEffect(() => {
    activeYearRef.current = year;
    generationRef.current += 1;
    loadedStatesRef.current.clear();
    setStateData({});
    setLoadingStates({});
    setStateErrors({});
    setMetadata(null);
    setSelectedState(null);
  }, [year]);

  useEffect(() => {
    if (!show) setSelectedState(null);
  }, [show]);

  // Shares popup and background requests so each state's totals are fetched once.
  const loadState = useCallback((state: string) => {
    if (loadedStatesRef.current.has(state)) return Promise.resolve(true);
    const generation = generationRef.current;
    const requestKey = `${generation}:${year}:${state}`;
    const pending = pendingRequestsRef.current.get(requestKey);
    if (pending) return pending;
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
    const request = cachedApiGet<HomeInvasionStateResponse>(
      `crime:homeInvasions:${year}:${state}`,
      `/api/v1/crime/homeInvasionsByState?${query.toString()}`,
      CACHE_TTL.CRIME,
    )
      .then((data) => {
        if (activeYearRef.current !== year || generationRef.current !== generation) return false;
        loadedStatesRef.current.add(state);
        setStateData((current) => ({ ...current, [state]: data.data }));
        const { data: _data, ...responseMetadata } = data;
        setMetadata(responseMetadata);
        return true;
      })
      .catch((requestError) => {
        if (activeYearRef.current !== year || generationRef.current !== generation) return false;
        console.error("[HomeInvasionMarkers] Fetch error:", requestError);
        setStateErrors((current) => ({
          ...current,
          [state]: "Home invasion data is currently unavailable.",
        }));
        return false;
      })
      .finally(() => {
        pendingRequestsRef.current.delete(requestKey);
        if (activeYearRef.current !== year || generationRef.current !== generation) return;
        setLoadingStates((current) => ({ ...current, [state]: false }));
      });
    pendingRequestsRef.current.set(requestKey, request);
    return request;
  }, [year]);

  // Fetch totals sequentially to shade states without a burst of FBI requests.
  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    const loadStates = async () => {
      for (const { state } of US_STATE_CENTERS) {
        if (cancelled) return;
        // Stop on an upstream failure; opening a popup can retry that state.
        if (!await loadState(state)) return;
      }
    };
    void loadStates();
    return () => { cancelled = true; };
  }, [loadState, show]);

  if (!show) return null;

  const selectedCenter = US_STATE_CENTERS.find(({ state }) => state === selectedState);
  const data = selectedState ? stateData[selectedState] : undefined;
  const loading = selectedState ? loadingStates[selectedState] : false;
  const error = selectedState ? stateErrors[selectedState] : undefined;

  return (
    <>
      <Pane name="home-invasion-states" style={{ zIndex: 410 }}>
        {states && <GeoJSON
          key={`${year}:${pinDropMode}`}
          data={states}
          interactive={!pinDropMode}
          bubblingMouseEvents={false}
          style={(feature) => {
            const state = FIPS_TO_STATE[String(feature?.id).padStart(2, "0")];
            const value = stateData[state];
            // Light state fills preserve underlying roads, terrain, and place labels.
            return { fillColor: homeInvasionFill(value?.reported ? value.total : undefined), fillOpacity: 0.45, color: "#ffffff", weight: 1 };
          }}
          onEachFeature={(feature, layer) => {
            const state = FIPS_TO_STATE[String(feature.id).padStart(2, "0")];
            if (!US_STATE_CENTERS.some((center) => center.state === state)) return;
            layer.on("click", () => { setSelectedState(state); void loadState(state); });
          }}
        />}
      </Pane>
      <Pane name="home-invasion-labels" style={{ zIndex: 610, pointerEvents: "none" }}>
        {US_STATE_CENTERS.map(({ state, latitude, longitude }) => (
          <Marker
            key={state}
            position={[latitude, longitude]}
            icon={icons[state]}
            interactive={false}
            keyboard={false}
            title={`${state}: ${stateData[state]?.reported ? `${numberFormatter.format(stateData[state].total)} reported offenses` : "data unavailable or loading"}`}
          />
        ))}
      </Pane>
      {selectedCenter && <Popup key={`${year}:${selectedState}`} position={[selectedCenter.latitude, selectedCenter.longitude]} eventHandlers={{ remove: () => setSelectedState((current) => current === selectedCenter.state ? null : current) }}>
              <div className="min-w-[210px] text-[#0c1022]">
                <h1 className="text-lg font-bold">Home Invasions in {selectedState}</h1>
                <p className="mt-1 text-center text-sm font-semibold">
                  {year}{year === 2026 ? " YTD" : ""}
                </p>
                {loading && <p className="mt-3 text-center text-sm">Loading…</p>}
                {!loading && !error && data?.reported && (
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
                    <p className="mt-2 text-center text-[11px] text-[#0c1022]/70">
                      Yellow to red shading indicates fewer to more reported offenses. Gray states have no available data.
                    </p>
                  </>
                )}
                {!loading && !error && data && !data.reported && (
                  <p className="mt-3 text-center text-sm">No reported residential offense data is available for this state and year.</p>
                )}
                {!loading && !error && !data && (
                  <p className="mt-3 text-center text-sm">Select this state to load data.</p>
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
            </Popup>}
      {!selectedCenter && <div className="leaflet-top leaflet-right" style={{ top: 100 }}>
        <div
          role="region"
          aria-label="Home Invasions source information"
          className="leaflet-control w-[220px] rounded-md border border-[#0c1022]/15 bg-white/95 p-3 text-[#0c1022] shadow-md"
          ref={(node) => {
            if (node) { L.DomEvent.disableClickPropagation(node); L.DomEvent.disableScrollPropagation(node); }
          }}
        >
          <p className="text-xs font-semibold">Home Invasions</p>
          <p className="mt-1 text-[11px]">Reporting year: {year}{year === 2026 ? " · Provisional YTD" : ""}</p>
          <p className="mt-2 text-[11px] leading-4">{metadata?.definition ?? "Robbery and burglary/breaking-and-entering offenses reported by NIBRS with a Residence/Home location."}</p>
          <div className="mt-2 h-2 rounded-sm" style={{ background: "linear-gradient(to right, #ffff00, #ff0000)" }} aria-hidden="true" />
          <p className="mt-1 text-[10px] leading-3">Yellow to red = fewer to more reported offenses. Gray = unavailable or loading.</p>
          <p className="mt-2 text-[10px] leading-3 text-[#0c1022]/70">Click a state for residential robbery and burglary totals. Reported counts are not population-adjusted rates.</p>
          <a className="mt-2 inline-block text-[11px] font-semibold text-[#312b7a] underline" href={sourceUrl} target="_blank" rel="noreferrer">Source: FBI Crime Data Explorer — NIBRS</a>
        </div>
      </div>}
    </>
  );
}
