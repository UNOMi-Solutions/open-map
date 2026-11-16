import { useEffect, useMemo, useState } from "react";
import { Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import { groupLocationSites } from "@/lib/datapoint-map-style";
import { ENERGY_COLORS, ENERGY_TYPES, EnergyPlant, EnergyType, energyCircleDiameter, energyGroupBackground, filterEnergyPlants } from "@/lib/energy-plants";

interface EnergyResponse {
  source: string;
  sourceUrl: string;
  period: string;
  total: number;
  excludedGeneratorCount: number;
  plants: EnergyPlant[];
}
const sourceUrl = "https://www.eia.gov/electricity/data/eia860m/";
const format = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export default function EnergyPlantMarkers({ types, sidebarOffsetPx = 0, pinDropMode = false }: { types: readonly EnergyType[]; sidebarOffsetPx?: number; pinDropMode?: boolean }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  const [visibleBounds, setVisibleBounds] = useState(() => map.getBounds().pad(0.2));
  useMapEvents({ zoomend: () => setZoom(map.getZoom()), moveend: () => setVisibleBounds(map.getBounds().pad(0.2)) });
  const [response, setResponse] = useState<EnergyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fetch one cached national snapshot; technology filters remain local and instant.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    cachedApiGet<EnergyResponse>("environment:energyPlants:v1", "/api/v1/environment/energyPlants", CACHE_TTL.ENVIRONMENT_GLOBAL, { forceRefresh: retry > 0 })
      .then((data) => { if (!cancelled) setResponse(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry]);

  const plants = useMemo(() => filterEnergyPlants(response?.plants ?? [], types), [response, types]);
  const selected = plants.find((plant) => plant.id === selectedId);
  const coincidentPlants = selected ? plants.filter(plant => plant.latitude === selected.latitude && plant.longitude === selected.longitude) : [];
  useEffect(() => { if (pinDropMode) setSelectedId(null); }, [pinDropMode]);
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selected, selectedId]);
  const groups = useMemo(() => groupLocationSites(plants, zoom, (latitude, longitude) => map.project([latitude, longitude], zoom)).map(([id, plants]) => {
    const capacity = plants.reduce((sum, plant) => sum + plant.capacityMw, 0);
    const diameter = energyCircleDiameter(plants.length);
    return { id, plants, capacity, latitude: plants.reduce((sum, plant) => sum + plant.latitude, 0) / plants.length,
      longitude: plants.reduce((sum, plant) => sum + plant.longitude, 0) / plants.length,
      icon: L.divIcon({ className: "", iconSize: [diameter, diameter], iconAnchor: [diameter / 2, diameter / 2],
        html: `<div class="energy-plant-circle" style="width:${diameter}px;height:${diameter}px;background:${energyGroupBackground(plants)}">${plants.length > 1 ? plants.length : ""}</div>` }) };
  }), [map, plants, zoom]);

  return <>
    {/* Limit rendered circles to the viewport so detailed zooms do not mount thousands of offscreen plants. */}
    {groups.filter((group) => visibleBounds.contains([group.latitude, group.longitude])).map((group) => <Marker key={`${group.id}:${pinDropMode}`} interactive={!pinDropMode} keyboard={!pinDropMode} icon={group.icon} position={[group.latitude, group.longitude]}
      title={group.plants.length === 1 ? group.plants[0].name : `${group.plants.length} energy plants — ${format.format(group.capacity)} MW — click to zoom in`}
      eventHandlers={{ click: () => {
        if (pinDropMode) return;
        if (group.plants.every(plant => plant.latitude === group.plants[0].latitude && plant.longitude === group.plants[0].longitude)) { setSelectedId(group.plants[0].id); return; }
        setSelectedId(null);
        const bounds = L.latLngBounds(group.plants.map((plant) => [plant.latitude, plant.longitude] as [number, number]));
        map.setView(bounds.getCenter(), Math.min(14, Math.max(zoom + 1, map.getBoundsZoom(bounds))));
      } }} />)}
    {selected && !pinDropMode && <Popup key={selected.id} position={[selected.latitude, selected.longitude]} keepInView
      autoPanPaddingTopLeft={[sidebarOffsetPx + 12, 100]} autoPanPaddingBottomRight={[12, 190]}
      eventHandlers={{ remove: () => setSelectedId((current) => current === selected.id ? null : current) }}>
      <div className="min-w-[210px] max-w-[300px] break-words text-[#0c1022]">
        {coincidentPlants.length > 1 && <label className="mb-3 block text-xs">Plants at this location
          <select className="mt-1 w-full rounded border border-[#0c1022]/20 bg-white p-1" value={selected.id} onChange={event => setSelectedId(event.target.value)}>
            {coincidentPlants.map(plant => <option key={plant.id} value={plant.id}>{plant.name}</option>)}
          </select>
        </label>}
        <h3 className="text-base font-bold">{selected.name}</h3>
        <p className="mt-1 text-xs font-semibold">Energy Plant · Operating</p>
        <dl className="mt-2 space-y-1 text-sm">
          <div><dt className="inline font-semibold">Location: </dt><dd className="inline">{[selected.county, selected.state].filter(Boolean).join(", ")}</dd></div>
          <div><dt className="inline font-semibold">Operator: </dt><dd className="inline">{selected.operator || "Not specified"}</dd></div>
          <div><dt className="inline font-semibold">EIA plant ID: </dt><dd className="inline">{selected.id}</dd></div>
          <div><dt className="inline font-semibold">Reporting month: </dt><dd className="inline">{response?.period}</dd></div>
          <div><dt className="inline font-semibold">Nameplate capacity: </dt><dd className="inline">{format.format(selected.capacityMw)} MW</dd></div>
          <div><dt className="inline font-semibold">Generators: </dt><dd className="inline">{selected.generatorCount}</dd></div>
        </dl>
        <div className="mt-3 space-y-1 text-xs">{ENERGY_TYPES.map((type) => selected.types[type] && <p key={type}>
          <strong className="capitalize">{type}: </strong>{format.format(selected.types[type]!.capacityMw)} MW · {selected.types[type]!.technologies.join(", ")}
        </p>)}</div>
        <p className="mt-3 text-[11px] leading-4 text-[#0c1022]/70">Capacity is not actual electricity generation. Values include only the selected technologies. Marker shows the EIA reference location, not a facility boundary.</p>
        <a className="mt-2 inline-block text-[11px] font-semibold text-[#312b7a] underline" href={sourceUrl} target="_blank" rel="noreferrer">Source: U.S. EIA — monthly generator inventory</a>
      </div>
    </Popup>}
    <div className="leaflet-top leaflet-left" style={{ top: 150, left: sidebarOffsetPx }}>
      <div className="leaflet-control w-[220px] rounded-md border border-[#0c1022]/15 bg-white/95 p-3 text-[#0c1022] shadow-md"
        ref={(node) => { if (node) { L.DomEvent.disableClickPropagation(node); L.DomEvent.disableScrollPropagation(node); } }}>
        <p className="text-xs font-semibold">Energy Plants</p>
        <p className="mt-1 text-[11px]" role="status">{loading ? "Loading EIA plants…" : error ? "Energy plant data is currently unavailable." : `${format.format(plants.length)} mapped plants · ${response?.period}`}</p>
        {error && <button className="mt-1 text-xs font-semibold text-[#312b7a] underline" type="button" onClick={() => setRetry((current) => current + 1)}>Try again</button>}
        <div className="mt-2 space-y-1 text-[11px]">{ENERGY_TYPES.map((type) => <div key={type} className="flex items-center gap-2 capitalize"><span className="inline-block h-3 w-3 rounded-full" style={{ background: ENERGY_COLORS[type] }} />{type}</div>)}</div>
        <p className="mt-1 text-[10px] leading-3">Multi-color circles show the capacity mix.</p>
        <p className="mt-2 text-[10px] leading-3 text-[#0c1022]/70">Circle size and numbers = plants in a group at this zoom level. Click a group to zoom in.</p>
        <p className="mt-1 text-[10px] leading-3 text-[#0c1022]/70">Monthly preliminary EIA inventory; operating utility-scale generators only. Not rooftop solar or all renewable installations.</p>
        {!!response?.excludedGeneratorCount && <p className="mt-1 text-[10px]">{response.excludedGeneratorCount} generator records omitted without usable coordinates or capacity.</p>}
        {!loading && !error && !types.length && <p className="mt-1 text-xs">Select a plant type in the sidebar.</p>}
        <a className="mt-2 inline-block text-[11px] font-semibold text-[#312b7a] underline" href={sourceUrl} target="_blank" rel="noreferrer">Source: U.S. EIA</a>
      </div>
    </div>
  </>;
}
