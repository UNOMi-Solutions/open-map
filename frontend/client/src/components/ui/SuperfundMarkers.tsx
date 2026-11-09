import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import { groupSuperfundSites, superfundCircleDiameter } from "@/lib/datapoint-map-style";

interface SuperfundSite {
  id: string;
  name: string;
  address: string;
  city: string;
  county: string;
  state: string;
  zipCode: string;
  status: string;
  latitude: number;
  longitude: number;
  sourceUrl: string;
}

interface SuperfundResponse {
  sites: SuperfundSite[];
  total: number;
  excludedSiteCount: number;
  retrievedAt: string;
}

type SiteBoundary = FeatureCollection<Polygon | MultiPolygon>;
const sourceUrl = "https://www.epa.gov/superfund";

export default function SuperfundMarkers({ sidebarOffsetPx = 0, pinDropMode = false }: { sidebarOffsetPx?: number; pinDropMode?: boolean }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const [response, setResponse] = useState<SuperfundResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [boundarySite, setBoundarySite] = useState<string | null>(null);
  const [boundaryAttempt, setBoundaryAttempt] = useState(0);
  const boundarySiteRef = useRef<string | null>(null);
  const boundaryShownRef = useRef(false);
  const boundaryPanelRef = useRef<HTMLDivElement | null>(null);
  const [mapSize, setMapSize] = useState(() => map.getSize());
  useMapEvents({ resize: () => setMapSize(map.getSize()) });
  const [boundaries, setBoundaries] = useState<Record<string, SiteBoundary>>({});
  const [boundaryLoading, setBoundaryLoading] = useState(false);
  const [boundaryError, setBoundaryError] = useState(false);

  // Rebuild count-sized circles on zoom; individual sites retain their EPA coordinates.
  const markerGroups = useMemo(() => {
    const groups = groupSuperfundSites(response?.sites ?? [], zoom, (latitude, longitude) => map.project([latitude, longitude], zoom));
    return groups.map(([key, sites]) => {
      const diameter = superfundCircleDiameter(sites.length);
      return {
        key, sites,
        latitude: sites.reduce((sum, site) => sum + site.latitude, 0) / sites.length,
        longitude: sites.reduce((sum, site) => sum + site.longitude, 0) / sites.length,
        icon: L.divIcon({
          className: "",
          html: `<div class="superfund-circle" style="width:${diameter}px;height:${diameter}px">${sites.length > 1 ? sites.length : ""}</div>`,
          iconSize: [diameter, diameter], iconAnchor: [diameter / 2, diameter / 2], popupAnchor: [0, -diameter / 2],
        }),
      };
    });
  }, [map, response, zoom]);

  // Cache the compact national marker list; boundaries are fetched separately on click.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    cachedApiGet<SuperfundResponse>(
      "environment:superfund:sites:v1",
      "/api/v1/environment/superfundSites",
      CACHE_TTL.ENVIRONMENT_GLOBAL,
      { forceRefresh: retry > 0 },
    ).then((data) => {
      if (!cancelled) setResponse(data);
    }).catch((requestError) => {
      console.error("[SuperfundMarkers] Fetch error:", requestError);
      if (!cancelled) setError(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [retry]);

  useEffect(() => {
    if (!boundarySite) return;
    let cancelled = false;
    setBoundaryLoading(true);
    setBoundaryError(false);
    cachedApiGet<SiteBoundary>(
      `environment:superfund:boundary:${boundarySite}`,
      `/api/v1/environment/superfundSites/${boundarySite}/boundary`,
      CACHE_TTL.ENVIRONMENT_GLOBAL,
    ).then((data) => {
      if (!cancelled) setBoundaries((current) => ({ ...current, [boundarySite]: data }));
    }).catch((requestError) => {
      console.error("[SuperfundMarkers] Boundary error:", requestError);
      if (!cancelled) setBoundaryError(true);
    }).finally(() => {
      if (!cancelled) setBoundaryLoading(false);
    });
    return () => { cancelled = true; };
  }, [boundaryAttempt, boundarySite]);

  const selectedBoundary = selectedSite ? boundaries[selectedSite] : undefined;
  const hasBoundary = !!selectedBoundary?.features.length;
  const showingBoundary = boundarySite === selectedSite && hasBoundary;
  boundaryShownRef.current = showingBoundary;
  const site = response?.sites.find((item) => item.id === selectedSite);
  const coincidentSites = site ? response?.sites.filter(item => item.latitude === site.latitude && item.longitude === site.longitude) ?? [] : [];
  useEffect(() => {
    if (pinDropMode) {
      boundarySiteRef.current = null;
      setBoundarySite(null);
      setSelectedSite(null);
    }
  }, [pinDropMode]);
  const compactPanel = mapSize.x - sidebarOffsetPx < 800;

  // Reserve room for the details panel so the entire boundary stays unobstructed.
  useLayoutEffect(() => {
    if (!showingBoundary || !selectedBoundary || !boundaryPanelRef.current) return;
    const bounds = L.geoJSON(selectedBoundary).getBounds();
    if (!bounds.isValid()) return;
    const panel = boundaryPanelRef.current;
    map.fitBounds(bounds, {
      paddingTopLeft: [sidebarOffsetPx + 36, 100],
      paddingBottomRight: compactPanel ? [36, panel.offsetHeight + 64] : [panel.offsetWidth + 48, 170],
      maxZoom: 16,
      animate: false,
    });
  }, [boundaryAttempt, compactPanel, map, mapSize, selectedBoundary, showingBoundary, sidebarOffsetPx]);

  const closeDetails = () => {
    boundarySiteRef.current = null;
    setBoundarySite(null);
    setSelectedSite(null);
  };

  const details = site && (
    <div className="w-full max-w-[300px] break-words text-[#0c1022]">
      {coincidentSites.length > 1 && <label className="mb-3 block text-xs">Sites at this location
        <select className="mt-1 w-full rounded border border-[#0c1022]/20 bg-white p-1" value={site.id} onChange={event => {
          boundarySiteRef.current = null;
          setBoundarySite(null);
          setSelectedSite(event.target.value);
        }}>
          {coincidentSites.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>}
      <h3 className="text-base font-bold">{site.name}</h3>
      <p className="mt-1 text-xs font-semibold">Superfund Site</p>
      <dl className="mt-2 space-y-1 text-sm">
        <div><dt className="inline font-semibold">Status: </dt><dd className="inline">{site.status}</dd></div>
        <div><dt className="inline font-semibold">Location: </dt><dd className="inline">{[site.city, site.state].filter(Boolean).join(", ")}</dd></div>
        {site.address && <div><dt className="inline font-semibold">Address: </dt><dd className="inline">{site.address}</dd></div>}
        <div><dt className="inline font-semibold">EPA ID: </dt><dd className="inline">{site.id}</dd></div>
      </dl>
      <div className="mt-3 text-xs" aria-live="polite">
        <button
          type="button"
          className="block font-semibold text-[#312b7a] underline disabled:opacity-60"
          disabled={boundaryLoading}
          onClick={() => {
            // Boundary requests and rendering start only after this explicit action.
            boundarySiteRef.current = site.id;
            setBoundaryError(false);
            setBoundarySite(site.id);
            setBoundaryAttempt((current) => current + 1);
          }}
        >Site Boundary</button>
        {boundaryLoading && <span>Loading site boundary…</span>}
        {!boundaryLoading && boundaryError && <span className="text-red-700">Site boundary is currently unavailable.</span>}
        {!boundaryLoading && boundarySite === site.id && !boundaryError && !hasBoundary && <span>No mapped boundary available.</span>}
      </div>
      <p className="mt-3 text-[11px] leading-4 text-[#0c1022]/70">
        Marker shows the EPA reference location. Select Site Boundary to show mapped site boundaries, where available.
      </p>
      <a className="mt-2 inline-block text-[11px] font-semibold text-[#312b7a] underline" href={site.sourceUrl} target="_blank" rel="noreferrer">
        Source: U.S. EPA — view site details
      </a>
    </div>
  );

  return (
    <>
      {showingBoundary && (
        <GeoJSON
          key={selectedSite}
          data={selectedBoundary!}
          interactive={false}
          style={{ color: "#b45309", weight: 2, fillColor: "#f59e0b", fillOpacity: 0.18 }}
        />
      )}
      {markerGroups.filter((group) => group.sites.length > 1).map((group) => (
        <Marker
          key={`group:${group.key}:${pinDropMode}`}
          interactive={!pinDropMode}
          keyboard={!pinDropMode}
          position={[group.latitude, group.longitude]}
          icon={group.icon}
          title={`${group.sites.length} Superfund sites — click to zoom in`}
          eventHandlers={{ click: () => {
            if (pinDropMode) return;
            if (group.sites.every(site => site.latitude === group.sites[0].latitude && site.longitude === group.sites[0].longitude)) {
              boundarySiteRef.current = null;
              setBoundarySite(null);
              setBoundaryError(false);
              setBoundaryLoading(false);
              setSelectedSite(group.sites[0].id);
              return;
            }
            const bounds = L.latLngBounds(group.sites.map((site) => [site.latitude, site.longitude] as [number, number]));
            const nextZoom = Math.min(14, Math.max(zoom + 1, map.getBoundsZoom(bounds)));
            map.setView(bounds.getCenter(), nextZoom);
          } }}
        />
      ))}
      {markerGroups.filter((group) => group.sites.length === 1).map(({ sites: [site], icon }) => (
        <Marker
          key={`${site.id}:${pinDropMode}`}
          interactive={!pinDropMode}
          keyboard={!pinDropMode}
          position={[site.latitude, site.longitude]}
          icon={icon}
          title={site.name}
          eventHandlers={{
            click: () => {
              if (pinDropMode) return;
              boundarySiteRef.current = null;
              setBoundarySite(null);
              setBoundaryError(false);
              setBoundaryLoading(false);
              setSelectedSite(site.id);
            },
          }}
        />
      ))}
      {site && !pinDropMode && !showingBoundary && (
        <Popup
          key={site.id}
          position={[site.latitude, site.longitude]}
          keepInView
          autoPanPaddingTopLeft={[sidebarOffsetPx + 12, 100]}
          autoPanPaddingBottomRight={[12, 160]}
          eventHandlers={{ remove: () => {
            if (!boundaryShownRef.current || boundarySiteRef.current !== site.id) {
              setSelectedSite((current) => current === site.id ? null : current);
              setBoundarySite((current) => current === site.id ? null : current);
            }
          } }}
        >{details}</Popup>
      )}
      {site && showingBoundary && (
        <div className={`leaflet-${compactPanel ? "bottom" : "top"} leaflet-right`} style={{ zIndex: 2500, ...(compactPanel ? { width: "100%" } : { top: 160 }) }}>
          <div
            ref={(node) => {
              boundaryPanelRef.current = node;
              if (node) { L.DomEvent.disableClickPropagation(node); L.DomEvent.disableScrollPropagation(node); }
            }}
            role="region"
            aria-label="Superfund site details"
            className="leaflet-control relative rounded-xl bg-white p-5 text-[#0c1022] shadow-lg"
            style={compactPanel ? { width: `calc(100% - ${sidebarOffsetPx + 32}px)`, maxHeight: mapSize.y * 0.35, overflowY: "auto", margin: 16, marginBottom: 40 } : { width: 340, maxHeight: Math.max(160, mapSize.y - 340), overflowY: "auto", marginRight: 12 }}
          >
            <button type="button" aria-label="Close site details" onClick={closeDetails} className="absolute right-2 top-1 text-xl text-gray-500">×</button>
            {details}
          </div>
        </div>
      )}
      <div className="leaflet-bottom leaflet-right" style={showingBoundary && compactPanel ? { display: "none" } : undefined}>
        <div
          className="leaflet-control w-[220px] rounded-md border border-[#0c1022]/15 bg-white/95 p-3 text-[#0c1022] shadow-md"
          ref={(node) => {
            if (node) { L.DomEvent.disableClickPropagation(node); L.DomEvent.disableScrollPropagation(node); }
          }}
        >
          <p className="text-xs font-semibold">Superfund Sites</p>
          <div className="mt-1 text-[11px] leading-4" role="status">
            {loading ? "Loading EPA sites…" : error ? "EPA site data is currently unavailable." : `${response?.total.toLocaleString() ?? 0} mapped sites`}
          </div>
          {error && <button type="button" className="mt-1 text-xs font-semibold text-[#312b7a] underline" onClick={() => setRetry((current) => current + 1)}>Try again</button>}
          {!!response?.excludedSiteCount && <p className="mt-1 text-[10px]">{response.excludedSiteCount} sites omitted without usable coordinates.</p>}
          <p className="mt-1 text-[10px] leading-3 text-[#0c1022]/70">EPA publishes weekly updates. This layer does not include every contaminated area.</p>
          <p className="mt-1 text-[10px] leading-3 text-[#0c1022]/70">Click a numbered group to zoom into individual sites.</p>
          <a className="mt-2 inline-block text-[11px] font-semibold text-[#312b7a] underline" href={sourceUrl} target="_blank" rel="noreferrer">Source: U.S. EPA</a>
        </div>
      </div>
    </>
  );
}
