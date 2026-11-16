import { useEffect, useMemo, useState } from "react";
import { GeoJSON, Marker, Pane, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection, Geometry, GeoJsonProperties } from "geojson";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import { superfundCircleDiameter } from "@/lib/datapoint-map-style";
import { FIPS_TO_STATE } from "@/lib/fips-to-state";
import { groupRiskPoints, RISK_META, RiskKind, RiskPoint, RiskRecord, RiskResponse, waterCountyColor, WATER_LEGEND } from "@/lib/environmental-risks";

type LoadState = { data?: RiskResponse; loading: boolean; error: boolean };
const EMPTY: LoadState = { loading: false, error: false };

function useRiskData(kind: RiskKind, enabled: boolean, year: string, retry: number): LoadState {
  const key = `${kind}:US:${year}`;
  const [result, setResult] = useState<LoadState & { key: string }>({ ...EMPTY, key: "" });
  useEffect(() => {
    let cancelled = false;
    if (!enabled) return;
    setResult({ key, loading: true, error: false });
    const path = `/api/v1/environment/${RISK_META[kind].endpoint}${year ? `?year=${encodeURIComponent(year)}` : ""}`;
    cachedApiGet<RiskResponse>(`environment:${key}:v2`, path, CACHE_TTL.ENVIRONMENT_GLOBAL, { forceRefresh: retry > 0 })
      .then(data => { if (!cancelled) setResult({ key, loading: false, error: false, data }); })
      .catch(() => { if (!cancelled) setResult({ key, loading: false, error: true }); });
    return () => { cancelled = true; };
  }, [key, enabled, retry]);
  return enabled && result.key === key ? result : EMPTY;
}

function RecordDetails({ record }: { record: RiskRecord }) {
  return <div className="mb-4 last:mb-0">
    <h3 className="text-base font-bold">{record.name}</h3>
    <dl className="mt-2 space-y-1 text-sm">{record.details.map(([label, value], index) => <div key={`${label}:${index}`}>
      <dt className="inline font-semibold">{label}: </dt><dd className="inline">{value}</dd>
    </div>)}</dl>
    <a className="mt-2 inline-block text-[11px] font-semibold text-[#312b7a] underline" href={record.sourceUrl} target="_blank" rel="noreferrer">View source record</a>
  </div>;
}

function RiskPoints({ points, kind, sidebarOffsetPx, pinDropMode }: { points: RiskPoint[]; kind: RiskKind; sidebarOffsetPx: number; pinDropMode: boolean }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [bounds, setBounds] = useState(map.getBounds().pad(0.2));
  const [selected, setSelected] = useState<RiskPoint[]>([]);
  useEffect(() => { if (pinDropMode) setSelected([]); }, [pinDropMode]);
  useMapEvents({ zoomend: () => setZoom(map.getZoom()), moveend: () => setBounds(map.getBounds().pad(0.2)) });
  const groups = useMemo(() => groupRiskPoints(points, zoom, (lat, lon) => map.project([lat, lon], zoom)).map(([id, records]) => {
    const diameter = superfundCircleDiameter(records.length);
    return { id, records,
      lat: records.reduce((n, p) => n + p.latitude, 0) / records.length,
      lon: records.reduce((n, p) => n + p.longitude, 0) / records.length,
      icon: L.divIcon({ className: "", iconSize: [diameter, diameter], iconAnchor: [diameter / 2, diameter / 2], popupAnchor: [0, -diameter / 2],
        html: `<div class="environment-risk-circle" style="background:${RISK_META[kind].color};width:${diameter}px;height:${diameter}px">${records.length > 1 ? records.length : ""}</div>` }),
    };
  }), [points, zoom, map, kind]);
  return <>
    {groups.filter(g => bounds.contains([g.lat, g.lon])).map(g => <Marker key={`${g.id}:${pinDropMode}`} position={[g.lat, g.lon]} icon={g.icon} interactive={!pinDropMode} keyboard={!pinDropMode}
      title={g.records.length === 1 ? g.records[0].name : `${g.records.length} ${kind === "fracking" ? "wells" : "facilities"} — click to explore`}
      eventHandlers={{ click: () => {
        if (pinDropMode) return;
        const extent = L.latLngBounds(g.records.map(p => [p.latitude, p.longitude] as [number, number]));
        if (g.records.length === 1 || extent.getNorthEast().equals(extent.getSouthWest())) setSelected(g.records);
        else { setSelected([]); map.setView(extent.getCenter(), Math.min(map.getMaxZoom(), Math.max(zoom + 1, map.getBoundsZoom(extent)))); }
      } }} />)}
    {!!selected.length && !pinDropMode && <Popup position={[selected[0].latitude, selected[0].longitude]} keepInView maxHeight={350}
      autoPanPaddingTopLeft={[sidebarOffsetPx + 12, 100]} autoPanPaddingBottomRight={[260, 180]} eventHandlers={{ remove: () => setSelected([]) }}>
      <div className="min-w-[220px] max-w-[300px] break-words text-[#0c1022]">
        <p className="mb-2 text-xs font-semibold">{RISK_META[kind].title}{selected.length > 1 ? ` · ${selected.length} locations` : ""}</p>
        {selected.map(p => <RecordDetails key={p.id} record={p} />)}
        <p className="mt-3 text-[11px] leading-4 text-[#0c1022]/70">{RISK_META[kind].note}</p>
      </div>
    </Popup>}
  </>;
}

function DrinkingWaterCounties({ data, counties, sidebarOffsetPx, pinDropMode }: {
  data: RiskResponse; counties: FeatureCollection<Geometry, GeoJsonProperties> | null; sidebarOffsetPx: number; pinDropMode: boolean;
}) {
  const [selected, setSelected] = useState<{ fips: string; name: string; position: L.LatLng } | null>(null);
  const [systemId, setSystemId] = useState("");
  // Like Drug Overdose Deaths, join the complete national county boundary set.
  const renderer = useMemo(() => L.svg(), []);
  const byFips = useMemo(() => new Map(data.counties?.map(c => [c.fips, c])), [data]);
  const geometry = counties;
  const county = selected ? byFips.get(selected.fips) : undefined;
  const systems = useMemo(() => data.systems?.filter(s => county?.systemIds.includes(s.id)).sort((a, b) => Number(b.flagged) - Number(a.flagged) || a.name.localeCompare(b.name)) ?? [], [county, data]);
  const system = systems.find(s => s.id === systemId) ?? systems[0];
  return <>
    {geometry && <Pane name="drinking-water-counties" style={{ zIndex: 421 }}><GeoJSON data={geometry} interactive={!pinDropMode} bubblingMouseEvents={false}
      style={f => ({ renderer, fillColor: waterCountyColor(byFips.get(String(f?.properties?.GEOID ?? f?.id).padStart(5, "0"))), fillOpacity: 0.68, color: "#ffffff", weight: 0.5 })}
      onEachFeature={(feature, layer) => {
        const fips = String(feature.properties?.GEOID ?? feature.id).padStart(5, "0");
        const state = FIPS_TO_STATE[fips.slice(0, 2)] || "";
        const name = String(feature.properties?.NAME || "County");
        const open = (position: L.LatLng) => { setSystemId(""); setSelected({ fips, name, position }); };
        layer.on("click", (event: L.LeafletMouseEvent) => open(event.latlng));
        layer.on("add", () => {
          const element = (layer as L.Path).getElement();
          if (!element || pinDropMode) return;
          element.setAttribute("aria-label", `Drinking water systems in ${name}, ${state}`);
          element.setAttribute("role", "button"); element.setAttribute("tabindex", "0");
          element.addEventListener("keydown", event => {
            if ((event as KeyboardEvent).key === "Enter" || (event as KeyboardEvent).key === " ") {
              event.preventDefault(); open((layer as L.Polygon).getBounds().getCenter());
            }
          });
        });
      }} /></Pane>}
    {selected && <Popup key={selected.fips} position={selected.position} keepInView maxHeight={360}
      autoPanPaddingTopLeft={[sidebarOffsetPx + 12, 100]} autoPanPaddingBottomRight={[260, 180]} eventHandlers={{ remove: () => setSelected(null) }}>
      <div className="min-w-[230px] max-w-[310px] break-words text-[#0c1022]">
        <h3 className="text-base font-bold">{selected.name}, {FIPS_TO_STATE[selected.fips.slice(0, 2)] || ""}</h3>
        <p className="mt-1 text-xs font-semibold">Reported Drinking Water Health Violations</p>
        <p className="mt-2 text-sm">{county ? `${county.flagged} of ${county.total} matched active systems carry EPA’s health-based violation flag.` : "No active water-system records matched to this county. This does not establish safe water."}</p>
        {!!county?.unknown && <p className="mt-1 text-xs">{county.unknown} systems have an unreported health flag.</p>}
        {!!systems.length && <label className="mt-3 block text-xs">Systems with health-based violation flags
          <select className="mt-1 w-full rounded border border-[#0c1022]/20 bg-white p-1 text-xs" value={system?.id || ""} onChange={e => setSystemId(e.target.value)}>
            {systems.map(s => <option key={s.id} value={s.id}>{s.flagged === true ? "Flagged · " : ""}{s.name}</option>)}
          </select>
        </label>}
        {system && <div className="mt-3"><RecordDetails record={system} /></div>}
        <p className="mt-3 text-[11px] leading-4 text-[#0c1022]/70">{RISK_META.drinkingWater.note} Systems may serve multiple counties, so counts cannot be added across counties. EPA data can lag current conditions.</p>
        <a className="mt-2 inline-block text-[11px] font-semibold text-[#312b7a] underline" href={RISK_META.drinkingWater.source} target="_blank" rel="noreferrer">Source: U.S. EPA SDWIS / ECHO</a>
      </div>
    </Popup>}
  </>;
}

export default function EnvironmentalRiskLayers({ active, selections, onOptionChange, counties, sidebarOffsetPx = 0, pinDropMode = false }: {
  active: RiskKind[]; selections: string[]; onOptionChange: (name: string, value: string) => void;
  counties: FeatureCollection<Geometry, GeoJsonProperties> | null; sidebarOffsetPx?: number; pinDropMode?: boolean;
}) {
  const option = (name: string, fallback: string) => selections.find(s => s.startsWith(`environment:${name}:`))?.split(":")[2] || fallback;
  const frackingYear = option("frackingYear", String(new Date().getFullYear() - 1));
  const runoffYear = option("runoffYear", String(new Date().getFullYear() - 2));
  const [retries, setRetries] = useState<Partial<Record<RiskKind, number>>>({});
  const loads: Record<RiskKind, LoadState> = {
    fracking: useRiskData("fracking", active.includes("fracking"), frackingYear, retries.fracking || 0),
    runoff: useRiskData("runoff", active.includes("runoff"), runoffYear, retries.runoff || 0),
    drinkingWater: useRiskData("drinkingWater", active.includes("drinkingWater"), "", retries.drinkingWater || 0),
  };
  if (!active.length) return null;
  return <>
    {active.filter(k => k !== "drinkingWater").map(kind => loads[kind]?.data && <RiskPoints key={`${kind}:${loads[kind]?.data?.year}:${loads[kind]?.data?.retrievedAt}`} kind={kind}
      points={loads[kind]?.data?.points ?? []} sidebarOffsetPx={sidebarOffsetPx} pinDropMode={pinDropMode} />)}
    {active.includes("drinkingWater") && loads.drinkingWater?.data && <DrinkingWaterCounties key={`${loads.drinkingWater.data.retrievedAt}:${pinDropMode}`}
      data={loads.drinkingWater.data} counties={counties} sidebarOffsetPx={sidebarOffsetPx} pinDropMode={pinDropMode} />}
    <div className="leaflet-top leaflet-right" style={{ top: 145 }}><div
      className="leaflet-control w-[240px] max-h-[calc(100vh-315px)] overflow-y-auto rounded-md border border-[#0c1022]/15 bg-white/95 p-3 text-[#0c1022] shadow-md"
      ref={node => { if (node) { L.DomEvent.disableClickPropagation(node); L.DomEvent.disableScrollPropagation(node); } }}>
      <p className="text-xs font-semibold">U.S. environmental data</p>
      {active.map(kind => {
        const load = loads[kind];
        const data = load.data;
        const year = kind === "fracking" ? frackingYear : runoffYear;
        return <section key={kind} className="mt-3 border-t border-[#0c1022]/10 pt-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold"><span className="inline-block h-3 w-3 rounded-full" style={{ background: RISK_META[kind].color }} />{RISK_META[kind].title}</h3>
          {kind !== "drinkingWater" && <label className="mt-2 block text-[11px]">Reporting year
            <select className="ml-2 rounded border border-[#0c1022]/20 bg-white p-1 text-xs" aria-label={`${RISK_META[kind].title} reporting year`} value={year} onChange={e => onOptionChange(kind === "fracking" ? "frackingYear" : "runoffYear", e.target.value)}>
              {Array.from({ length: new Date().getFullYear() - (kind === "fracking" ? 2011 : 2000) + 1 }, (_, i) => String(new Date().getFullYear() - i)).map(y => <option key={y}>{y}</option>)}
            </select>
          </label>}
          {<p className="mt-2 text-[11px]" role="status">{load.loading ? "Loading nationwide source data…" : load.error ? "Source data is unavailable for this selection." : data ? kind === "drinkingWater" ? `${data.totalSystems?.toLocaleString()} active systems · ${data.systems?.filter(s => s.flagged).length.toLocaleString()} flagged` : `${data.points?.length.toLocaleString()} mapped ${kind === "fracking" ? "wells" : "facilities"} across the U.S.` : ""}</p>}
          {load.error && <button className="mt-1 text-xs font-semibold text-[#312b7a] underline" onClick={() => setRetries(r => ({ ...r, [kind]: (r[kind] || 0) + 1 }))}>Try again</button>}
          {data && kind === "drinkingWater" && <>
            <p className="mt-2 text-[11px] font-semibold">Flagged systems serving each county</p>
            {WATER_LEGEND.map(entry => <div className="mt-1 flex items-center gap-2 text-[10px]" key={entry.label}><span className="h-3 w-3 rounded-sm border border-black/15" style={{ background: entry.color }} />{entry.label}</div>)}
            {!counties && <p className="mt-2 text-xs">County boundaries unavailable. Reload the map to retry.</p>}
            {!!data.unmappedSystems && <p className="mt-1 text-[10px]">{data.unmappedSystems} systems have no county location.</p>}
          </>}
          {data && kind !== "drinkingWater" && <p className="mt-2 text-[10px]">Circle size and numbers = locations in a group. Click to zoom or view details.{data.points?.length === 0 ? " No matching mapped locations for this selection." : ""}</p>}
          <p className="mt-2 text-[10px] leading-4 text-[#0c1022]/70">{RISK_META[kind].note}</p>
          {data && <p className="mt-1 text-[10px] text-[#0c1022]/70">{kind === "fracking" ? "Disclosures updated on weekdays." : kind === "runoff" ? "Annual reporting with revisions." : "EPA snapshot; reporting can lag."} Retrieved {data.retrievedAt.slice(0, 10)}.{!!data.excluded && ` ${data.excluded} source records omitted for invalid or missing fields.`}</p>}
          <a className="mt-2 inline-block text-[11px] font-semibold text-[#312b7a] underline" href={RISK_META[kind].source} target="_blank" rel="noreferrer">Source: {kind === "fracking" ? "FracFocus" : "U.S. EPA"}</a>
        </section>;
      })}
    </div></div>
  </>;
}
