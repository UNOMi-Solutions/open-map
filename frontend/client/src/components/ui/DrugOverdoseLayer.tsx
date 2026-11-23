import { useEffect, useMemo, useState } from "react";
import { GeoJSON, Pane, Popup } from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection, Geometry, GeoJsonProperties } from "geojson";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import { OVERDOSE_LEGEND, OVERDOSE_SUPPRESSED_COLOR, OVERDOSE_UNAVAILABLE_COLOR, OverdoseResponse, overdoseFill, overdosePeriodLabel, overdoseWindowLabel } from "@/lib/drug-overdose";

const sourceUrl = "https://www.cdc.gov/nchs/nvss/vsrr/prov-county-drug-overdose.htm";
const populationSourceUrl = "https://www.census.gov/data/datasets/time-series/demo/popest/2020s-counties-total.html";

export default function DrugOverdoseLayer({ counties, period, onPeriodChange, pinDropMode = false, sidebarOffsetPx = 0 }: {
  counties: FeatureCollection<Geometry, GeoJsonProperties> | null;
  period: string;
  onPeriodChange: (period: string) => void;
  pinDropMode?: boolean;
  sidebarOffsetPx?: number;
}) {
  const [response, setResponse] = useState<OverdoseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<{ fips: string; name: string; position: L.LatLng } | null>(null);
  useEffect(() => { if (pinDropMode) setSelected(null); }, [pinDropMode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setResponse(null);
    setSelected(null);
    cachedApiGet<OverdoseResponse>(`health:drugOverdose:${period}:v1`, `/api/v1/health/drugOverdoseDeaths?period=${encodeURIComponent(period)}`, CACHE_TTL.HEALTH, { forceRefresh: retry > 0 })
      .then((data) => { if (!cancelled) setResponse(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period, retry]);
  const byFips = useMemo(() => new Map(response?.counties.map((county) => [county.fips, county])), [response]);
  const summary = useMemo(() => {
    const mappedFips = new Set(counties?.features.map((feature) => String(feature.properties?.GEOID ?? feature.id).padStart(5, "0")));
    const records = response?.counties ?? [];
    return {
      rates: records.filter((county) => county.rate !== null && mappedFips.has(county.fips)).length,
      suppressed: records.filter((county) => county.countStatus === "suppressed").length,
      unmatched: records.filter((county) => !mappedFips.has(county.fips)).length,
    };
  }, [counties, response]);
  const details = selected ? byFips.get(selected.fips) : undefined;
  const boundariesUnavailable = !loading && !error && !counties;

  return <>
    {counties && response && !loading && !error && <Pane name="drug-overdose-counties" style={{ zIndex: 420 }}>
      <GeoJSON key={`${response.period}:${response.dataAsOf}:${pinDropMode}`} data={counties}
        interactive={!pinDropMode} bubblingMouseEvents={false}
        style={(feature) => ({
          fillColor: overdoseFill(byFips.get(String(feature?.properties?.GEOID ?? feature?.id).padStart(5, "0"))),
          fillOpacity: 0.68, color: "#ffffff", weight: 0.5,
        })}
        onEachFeature={(feature, layer) => {
          const fips = String(feature.properties?.GEOID ?? feature.id).padStart(5, "0");
          layer.on("click", (event: L.LeafletMouseEvent) => setSelected({ fips, name: String(feature.properties?.NAME || fips), position: event.latlng }));
        }} />
    </Pane>}
    {selected && response && !pinDropMode && <Popup key={`${response.period}:${selected.fips}`} position={selected.position} keepInView maxHeight={350}
      autoPanPaddingTopLeft={[sidebarOffsetPx + 12, 100]} autoPanPaddingBottomRight={[12, 170]}
      eventHandlers={{ remove: () => setSelected((current) => current?.fips === selected.fips ? null : current) }}>
      <div className="min-w-[220px] max-w-[300px] break-words text-[#0c1022]">
        <h3 className="text-base font-bold">{details ? `${details.name}, ${details.state}` : selected.name}</h3>
        <p className="mt-1 text-xs font-semibold">Drug Overdose Deaths · Provisional</p>
        <p className="mt-1 text-xs">12 months: {overdoseWindowLabel(response.period)}</p>
        <dl className="mt-3 space-y-1 text-sm">
          <div><dt className="inline font-semibold">Deaths: </dt><dd className="inline">{details?.countStatus === "suppressed" ? "Suppressed (1–9)" : details?.count != null ? details.count.toLocaleString() : "Unavailable"}</dd></div>
          <div><dt className="inline font-semibold">Per 100,000 residents: </dt><dd className="inline">{details?.rate != null ? details.rate.toFixed(1) : details?.countStatus === "suppressed" ? "Suppressed" : "Unavailable"}</dd></div>
          {details?.population != null && <div><dt className="inline font-semibold">Population ({details.populationYear}): </dt><dd className="inline">{details.population.toLocaleString()}</dd></div>}
          {details?.pendingPercent != null && <div><dt className="inline font-semibold">Records pending investigation: </dt><dd className="inline">{details.pendingPercent.toFixed(1)}%</dd></div>}
          <div><dt className="inline font-semibold">CDC data as of: </dt><dd className="inline">{response.dataAsOf}</dd></div>
        </dl>
        {details?.countStatus === "suppressed" && <p className="mt-2 text-xs">CDC suppresses counts of 1–9. Suppressed values are not zero.</p>}
        {details?.count != null && details.population === null && <p className="mt-2 text-xs">No matching population estimate is available for this county; a rate has not been calculated.</p>}
        {!details && <p className="mt-2 text-xs">No matching CDC county record is available for this boundary and reporting period.</p>}
        {details?.completenessNote && <p className="mt-2 text-xs">{details.completenessNote}</p>}
        {details?.dataNote && <p className="mt-2 text-xs">{details.dataNote}</p>}
        <p className="mt-3 text-[11px] leading-4 text-[#0c1022]/70">By county of residence. Counts may be incomplete and revised. Rates are crude, not age-adjusted, and use the labeled annual population estimate. This measures deaths, not addiction prevalence.</p>
        <a className="mt-2 inline-block text-[11px] font-semibold text-[#312b7a] underline" href={sourceUrl} target="_blank" rel="noreferrer">Source: CDC/NCHS — overdose deaths</a>
        <a className="mt-1 block text-[11px] font-semibold text-[#312b7a] underline" href={populationSourceUrl} target="_blank" rel="noreferrer">Population: U.S. Census Bureau</a>
      </div>
    </Popup>}
    {!selected && <div className="leaflet-top leaflet-right" style={{ top: 100 }}>
      <div className="leaflet-control w-[240px] max-h-[calc(100vh-260px)] overflow-y-auto rounded-md border border-[#0c1022]/15 bg-white/95 p-3 text-[#0c1022] shadow-md"
        ref={(node) => { if (node) { L.DomEvent.disableClickPropagation(node); L.DomEvent.disableScrollPropagation(node); } }}>
        <p className="text-xs font-semibold">Drug Overdose Deaths</p>
        <label className="mt-2 block text-[11px]" htmlFor="overdose-reporting-period">12 months ending</label>
        <select id="overdose-reporting-period" className="mt-1 w-full rounded border border-[#0c1022]/20 bg-white px-2 py-1 text-xs" value={period} onChange={(event) => onPeriodChange(event.target.value)}>
          <option value="latest">Latest available{response ? ` (${overdosePeriodLabel(response.availablePeriods[0])})` : ""}</option>
          {response?.availablePeriods.map((option) => <option value={option} key={option}>{overdosePeriodLabel(option)}</option>)}
          {!response && period !== "latest" && <option value={period}>{overdosePeriodLabel(period)}</option>}
        </select>
        <p className="mt-2 text-[11px]" role="status">{loading ? "Loading CDC county data…" : error ? "Overdose data is currently unavailable." : boundariesUnavailable ? "County boundaries are unavailable. Reload the map to retry." : `${summary.rates.toLocaleString()} counties with mapped rates`}</p>
        {error && <button type="button" className="mt-1 text-xs font-semibold text-[#312b7a] underline" onClick={() => setRetry((current) => current + 1)}>Try again</button>}
        {response && <>
          <p className="mt-1 text-[10px]">{overdoseWindowLabel(response.period)} · Provisional</p>
          <p className="mt-2 text-[11px] font-semibold">Deaths per 100,000 residents</p>
          <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">{OVERDOSE_LEGEND.map((entry) => <div key={entry.label} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-black/15" style={{ background: entry.color }} />{entry.label}</div>)}</div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px]"><span className="h-3 w-3 rounded-sm" style={{ background: OVERDOSE_SUPPRESSED_COLOR }} />Suppressed (1–9 deaths)</div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px]"><span className="h-3 w-3 rounded-sm" style={{ background: OVERDOSE_UNAVAILABLE_COLOR }} />Rate unavailable / no matching data</div>
          <p className="mt-2 text-[10px] leading-3">{summary.suppressed.toLocaleString()} county counts suppressed. Click a county for details and population year.</p>
          {!!summary.unmatched && <p className="mt-1 text-[10px] leading-3">{summary.unmatched} CDC county records have no matching map boundary.</p>}
          <p className="mt-1 text-[10px] leading-3 text-[#0c1022]/70">Crude rates; not age-adjusted. CDC updates quarterly with a reporting lag. Data as of {response.dataAsOf}.</p>
        </>}
        <a className="mt-2 inline-block text-[11px] font-semibold text-[#312b7a] underline" href={sourceUrl} target="_blank" rel="noreferrer">Source: CDC/NCHS</a>
      </div>
    </div>}
  </>;
}
