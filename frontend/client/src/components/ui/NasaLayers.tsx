// NASA satellite layers (GIBS): one component renders every selected layer and one shared legend.
// The list of layers and the date rules live in @/lib/nasaLayers; request details (tile URL,
// native zoom, available dates, legend image) come from the backend, which reads NASA's capabilities.
import L from "leaflet";
import { useMap } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import {
  NASA_LAYERS,
  NASA_PREFIX,
  NASA_REGISTRY_KEY,
  describeTime,
  resolveTime,
  type NasaLayersResponse,
} from "@/lib/nasaLayers";

const API_PATH = `/api/v1/environment/nasaLayers?ids=${NASA_LAYERS.map((l) => l.gibsId).join(",")}`;

// 1x1 transparent PNG so a failed tile never shows a broken-image icon
const BLANK_TILE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==";

// Southern edge for landOnly layers; tiles wholly south of this are never requested
const LAND_BOUNDS = L.latLngBounds([-60, -180], [85, 180]);

const today = () => new Date().toISOString().slice(0, 10);

type Props = {
  /** Selected sidebar ids, e.g. ["nasa:true-color", "nasa:air-temperature"] */
  layerIds: string[];
  /** Picked data date (YYYY-MM-DD); null shows each layer's newest complete data */
  date: string | null;
  onDateChange?: (date: string | null) => void;
  setLoading?: (state: boolean) => void;
};

const NasaLayers = ({ layerIds, date, onDateChange, setLoading }: Props) => {
  const map = useMap();
  const [meta, setMeta] = useState<NasaLayersResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading?.(true);
    cachedApiGet<NasaLayersResponse>(`environment:nasaLayers:${NASA_REGISTRY_KEY}`, API_PATH, CACHE_TTL.NASA_LAYERS)
      .then((m) => {
        if (cancelled) return;
        if (!m?.layers) return console.error("[NasaLayers] Unexpected response shape:", m);
        if (m.missing?.length) console.warn("[NasaLayers] Not offered by NASA GIBS right now:", m.missing);
        setMeta(m);
      })
      .catch((err) => console.error("[NasaLayers] Fetch error:", err))
      .finally(() => setLoading?.(false));
    return () => {
      cancelled = true;
      setLoading?.(false);
    };
  }, [setLoading]);

  // Selected layers that NASA currently serves, each with the date it will actually show
  const selection = layerIds.join("|");
  const active = useMemo(() => {
    if (!meta) return [];
    const ids = new Set(selection.split("|"));
    return NASA_LAYERS.filter((l) => ids.has(NASA_PREFIX + l.id) && meta.layers[l.gibsId]).map((layer) => {
      const info = meta.layers[layer.gibsId];
      return { layer, info, time: resolveTime(info, date, layer.lag ?? 1) };
    });
  }, [meta, selection, date]);

  useEffect(() => {
    if (!meta || !active.length) return;

    const tiles = active.map(({ layer, info, time }, i) => {
      const tile = L.tileLayer(info.template.replace("{time}", time ?? ""), {
        opacity: layer.imagery ? 1 : 0.7,
        attribution: `<a href="${meta.sourceUrl}" target="_blank" rel="noopener">${meta.attribution}</a>`,
        maxNativeZoom: info.maxNativeZoom,
        maxZoom: 19,
        errorTileUrl: BLANK_TILE,
        ...(layer.landOnly ? { bounds: LAND_BOUNDS } : {}),
        zIndex: layer.imagery ? 4 : 5 + i, // photos under data layers
      }).addTo(map);
      // Past the native zoom Leaflet stretches tiles; crisp pixels avoid blurry seams between them
      const el = tile.getContainer();
      if (el) el.style.imageRendering = "pixelated";
      if (import.meta.env.DEV) {
        console.debug(`[NasaLayers] ${layer.gibsId} time=${time ?? "none"} maxNativeZoom=${info.maxNativeZoom}`);
        // Leaflet has already swapped in BLANK_TILE here, so rebuild the URL that failed
        tile.on("tileerror", (e) => console.warn("[NasaLayers] tile failed:", tile.getTileUrl((e as L.TileErrorEvent).coords)));
      }
      return tile;
    });

    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "choropleth-info");
      div.style.cssText = "width:260px;max-height:45vh;overflow-y:auto;font-size:12px;line-height:1.4";
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);

      const h4 = L.DomUtil.create("h4", "", div);
      h4.textContent = "NASA Satellite Data";
      h4.style.cssText = "font-size:13px;margin:0 0 6px";

      // Date control: one date for every NASA layer; each layer shows its closest earlier data
      const row = L.DomUtil.create("div", "", div);
      row.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:8px";
      const label = L.DomUtil.create("label", "", row);
      label.textContent = "Date";
      label.htmlFor = "nasa-data-date";
      const input = L.DomUtil.create("input", "", row) as HTMLInputElement;
      input.type = "date";
      input.id = "nasa-data-date";
      input.max = today();
      input.value = date ?? "";
      input.style.cssText = "flex:1;min-width:0;font-size:12px;padding:2px 4px;border:1px solid #ccc;border-radius:4px;background:#fff";
      const latest = L.DomUtil.create("button", "", row) as HTMLButtonElement;
      latest.type = "button";
      latest.textContent = "Latest";
      latest.disabled = !date;
      latest.style.cssText = `font-size:12px;padding:2px 8px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;opacity:${date ? 1 : 0.5}`;
      if (onDateChange) {
        L.DomEvent.on(input, "change", () => onDateChange(input.value || null));
        L.DomEvent.on(latest, "click", () => onDateChange(null));
      } else {
        input.disabled = latest.disabled = true;
      }

      for (const { layer, info, time } of active) {
        const item = L.DomUtil.create("div", "", div);
        item.style.cssText = "border-top:1px solid #ddd;padding:6px 0";
        const title = L.DomUtil.create("div", "", item);
        title.textContent = layer.title;
        title.style.cssText = "font-weight:700;color:#333";
        const note = L.DomUtil.create("div", "", item);
        note.textContent = layer.note;
        note.style.color = "#555";
        if (info.legendUrl) {
          const img = L.DomUtil.create("img", "", item) as HTMLImageElement;
          img.alt = `${layer.title} colour scale`;
          img.style.cssText = "display:block;width:100%;height:auto;margin:4px 0;max-width:none";
          img.onerror = () => img.remove();
          img.src = info.legendUrl;
        }
        const when = L.DomUtil.create("div", "", item);
        when.textContent = describeTime(info, time);
        when.style.color = "#777";
      }

      const foot = L.DomUtil.create("small", "", div);
      foot.textContent = `Satellite and model estimates, not ground measurements. Source: ${meta.attribution}`;
      foot.style.cssText = "display:block;border-top:1px solid #ddd;padding-top:6px;color:#777";
      return div;
    };
    legend.addTo(map);

    return () => {
      tiles.forEach((t) => map.removeLayer(t));
      map.removeControl(legend);
    };
  }, [meta, active, date, onDateChange, map]);

  return null;
};

export default NasaLayers;
