import { useEffect, useMemo, useState } from "react";
import { Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import { superfundCircleDiameter } from "@/lib/datapoint-map-style";
import { groupSewageOutfalls, SewageOutfall } from "@/lib/sewage-discharge";

interface SewageResponse {
  total: number;
  excludedOutfallCount: number;
  retrievedAt: string;
  outfalls: SewageOutfall[];
}
const sourceUrl = "https://echo.epa.gov/tools/data-downloads/cso-inventory-summary";
const permitStatuses: Record<string, string> = {
  EFF: "Effective", ADC: "Administratively continued", EXP: "Expired",
  PND: "Pending", RET: "Retired", NON: "Not needed", TRM: "Terminated",
};

export default function SewageDischargeMarkers({ sidebarOffsetPx = 0, pinDropMode = false }: { sidebarOffsetPx?: number; pinDropMode?: boolean }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  const [visibleBounds, setVisibleBounds] = useState(() => map.getBounds().pad(0.2));
  useMapEvents({ zoomend: () => setZoom(map.getZoom()), moveend: () => setVisibleBounds(map.getBounds().pad(0.2)) });
  const [response, setResponse] = useState<SewageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => { if (pinDropMode) setSelectedIds([]); }, [pinDropMode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    cachedApiGet<SewageResponse>("environment:sewageDischarge:v1", "/api/v1/environment/sewageDischarge", CACHE_TTL.ENVIRONMENT_GLOBAL, { forceRefresh: retry > 0 })
      .then((data) => { if (!cancelled) setResponse(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry]);

  const groups = useMemo(() => groupSewageOutfalls(response?.outfalls ?? [], zoom, (latitude, longitude) => map.project([latitude, longitude], zoom))
    .map(([id, outfalls]) => {
      const diameter = superfundCircleDiameter(outfalls.length);
      return {
        id, outfalls,
        latitude: outfalls.reduce((sum, outfall) => sum + outfall.latitude, 0) / outfalls.length,
        longitude: outfalls.reduce((sum, outfall) => sum + outfall.longitude, 0) / outfalls.length,
        icon: L.divIcon({ className: "", iconSize: [diameter, diameter], iconAnchor: [diameter / 2, diameter / 2], popupAnchor: [0, -diameter / 2],
          html: `<div class="sewage-outfall-circle" style="width:${diameter}px;height:${diameter}px">${outfalls.length > 1 ? outfalls.length : ""}</div>` }),
      };
    }), [map, response, zoom]);
  const selected = useMemo(() => {
    const ids = new Set(selectedIds);
    return response?.outfalls.filter((outfall) => ids.has(outfall.id)) ?? [];
  }, [response, selectedIds]);

  return <>
    {groups.filter((group) => visibleBounds.contains([group.latitude, group.longitude])).map((group) => <Marker
      key={`${group.id}:${pinDropMode}`} interactive={!pinDropMode} keyboard={!pinDropMode} position={[group.latitude, group.longitude]} icon={group.icon}
      title={group.outfalls.length === 1 ? `${group.outfalls[0].facilityName} — ${group.outfalls[0].name}` : `${group.outfalls.length} sewage outfalls — click to explore`}
      eventHandlers={{ click: () => {
        if (pinDropMode) return;
        const bounds = L.latLngBounds(group.outfalls.map((outfall) => [outfall.latitude, outfall.longitude] as [number, number]));
        if (group.outfalls.length === 1 || bounds.getSouthWest().equals(bounds.getNorthEast())) {
          setSelectedIds(group.outfalls.map((outfall) => outfall.id));
        } else {
          setSelectedIds([]);
          map.setView(bounds.getCenter(), Math.min(map.getMaxZoom(), Math.max(zoom + 1, map.getBoundsZoom(bounds))));
        }
      } }} />)}
    {!!selected.length && !pinDropMode && <Popup key={selectedIds.join(":")} position={[selected[0].latitude, selected[0].longitude]} keepInView
      maxHeight={320} autoPanPaddingTopLeft={[sidebarOffsetPx + 12, 100]} autoPanPaddingBottomRight={[12, 180]}
      eventHandlers={{ remove: () => setSelectedIds((current) => current.join(":") === selectedIds.join(":") ? [] : current) }}>
      <div className="min-w-[210px] max-w-[300px] break-words text-[#0c1022]">
        {selected.length > 1 && <p className="mb-3 text-xs font-semibold">{selected.length} outfalls at this location</p>}
        {selected.map((outfall) => <div key={outfall.id} className="mb-4 last:mb-0">
          <h3 className="text-base font-bold">{outfall.facilityName}</h3>
          <p className="mt-1 text-xs font-semibold">Combined Sewer Overflow Outfall</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div><dt className="inline font-semibold">Outfall: </dt><dd className="inline">{outfall.name}</dd></div>
            <div><dt className="inline font-semibold">Location: </dt><dd className="inline">{[outfall.city, outfall.state].filter(Boolean).join(", ") || "Not specified"}</dd></div>
            <div><dt className="inline font-semibold">Receiving water: </dt><dd className="inline">{outfall.waterbody}</dd></div>
            <div><dt className="inline font-semibold">Classification: </dt><dd className="inline">{outfall.treatment}</dd></div>
            <div><dt className="inline font-semibold">NPDES permit: </dt><dd className="inline">{outfall.permitId}</dd></div>
            {outfall.outfallNumber && <div><dt className="inline font-semibold">Outfall ID: </dt><dd className="inline">{outfall.outfallNumber}</dd></div>}
            <div><dt className="inline font-semibold">Permit status: </dt><dd className="inline">{permitStatuses[outfall.permitStatus] || outfall.permitStatus}</dd></div>
          </dl>
          <a className="mt-2 inline-block text-[11px] font-semibold text-[#312b7a] underline" href={outfall.sourceUrl} target="_blank" rel="noreferrer">Source: U.S. EPA — view details</a>
        </div>)}
        <p className="mt-3 text-[11px] leading-4 text-[#0c1022]/70">Known overflow outlet; this does not indicate a discharge is happening now. Coordinates identify the outfall, not the facility office.</p>
      </div>
    </Popup>}
    {!selected.length && <div className="leaflet-top leaflet-right" style={{ top: 100 }}>
      <div className="leaflet-control w-[220px] rounded-md border border-[#0c1022]/15 bg-white/95 p-3 text-[#0c1022] shadow-md"
        ref={(node) => { if (node) { L.DomEvent.disableClickPropagation(node); L.DomEvent.disableScrollPropagation(node); } }}>
        <p className="text-xs font-semibold">Sewage Discharge</p>
        <p className="mt-1 text-[11px]" role="status">{loading ? "Loading EPA outfalls…" : error ? "EPA outfall data is currently unavailable." : `${response?.total.toLocaleString() ?? 0} mapped CSO outfalls`}</p>
        {error && <button className="mt-1 text-xs font-semibold text-[#312b7a] underline" type="button" onClick={() => setRetry((current) => current + 1)}>Try again</button>}
        <div className="mt-2 flex items-center gap-2 text-[11px]"><span className="sewage-outfall-circle inline-block h-3 w-3" />Combined sewer overflow outfall</div>
        <p className="mt-2 text-[10px] leading-3">Circle size and numbers = outfalls in a group. Click to zoom in or view details.</p>
        <p className="mt-1 text-[10px] leading-3 text-[#0c1022]/70">EPA inventory updated weekly. Known outlets, not live spills; coverage is incomplete.</p>
        {!!response?.excludedOutfallCount && <p className="mt-1 text-[10px]">{response.excludedOutfallCount.toLocaleString()} records omitted without valid outfall locations or active CSO classifications.</p>}
        {!loading && !error && response?.total === 0 && <p className="mt-1 text-xs">No mapped outfalls are available.</p>}
        <a className="mt-2 inline-block text-[11px] font-semibold text-[#312b7a] underline" href={sourceUrl} target="_blank" rel="noreferrer">Source: U.S. EPA — CSO Inventory</a>
      </div>
    </div>}
  </>;
}
