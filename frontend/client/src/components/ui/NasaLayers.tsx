// NASA satellite layers (GIBS): one component renders every selected layer and one shared legend
// (upper right, one foldable row per layer, outlined in the layer's timeline colour).
// The list of layers and the date rules live in @/lib/nasaLayers; request details (tile URL,
// native zoom, available dates, legend image) come from the backend, which reads NASA's capabilities.
import L from "leaflet";
import { useMap } from "react-leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import {
  NASA_LAYERS,
  NASA_PREFIX,
  NASA_REGISTRY_KEY,
  availableDays,
  describeTime,
  resolveTime,
  type NasaLayersResponse,
} from "@/lib/nasaLayers";
import { formatTimelineDate, type TimelineDatasetMeta, type TimelineDateRange } from "@/lib/timeline";
import { subscribeTimelinePreview } from "@/lib/timelinePreview";
import { getMapRailLegends } from "./MapRail";

const API_PATH = `/api/v1/environment/nasaLayers?ids=${NASA_LAYERS.map((l) => l.gibsId).join(",")}`;

// 1x1 transparent PNG so a failed tile never shows a broken-image icon
const BLANK_TILE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==";

// Southern edge for landOnly layers; tiles wholly south of this are never requested
const LAND_BOUNDS = L.latLngBounds([-60, -180], [85, 180]);

type Props = {
  /** Selected sidebar ids, e.g. ["nasa:true-color", "nasa:air-temperature"] */
  layerIds: string[];
  /** Day picked on the timeline per layer, keyed "nasa:<id>"; missing = newest complete data */
  dateRanges?: Record<string, TimelineDateRange>;
  /** Timeline colour per layer, keyed "nasa:<id>"; outlines the layer's legend row */
  colors?: Record<string, string>;
  /** Reports each dated layer (as "nasa:<id>") and the days it holds to the timeline */
  onDateRangeChange?: (datasetId: string, range: TimelineDateRange | null, meta?: TimelineDatasetMeta) => void;
  setLoading?: (state: boolean) => void;
};

const NasaLayers = ({ layerIds, dateRanges, colors, onDateRangeChange, setLoading }: Props) => {
  const map = useMap();
  const [meta, setMeta] = useState<NasaLayersResponse | null>(null);
  const tiles = useRef(new Map<string, L.TileLayer>()); // "gibsId|time" -> layer on the map
  const folded = useRef(new Set<string>()); // legend rows folded down to their date
  const reported = useRef(new Set<string>()); // dataset ids currently on the timeline

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
  const datesKey = dateRanges ? Object.entries(dateRanges).map(([k, r]) => `${k}=${r.end}`).join("|") : "";
  const active = useMemo(() => {
    if (!meta) return [];
    const ids = new Set(selection.split("|"));
    return NASA_LAYERS.filter((l) => ids.has(NASA_PREFIX + l.id) && meta.layers[l.gibsId]).map((layer) => {
      const info = meta.layers[layer.gibsId];
      const picked = dateRanges?.[NASA_PREFIX + layer.id];
      // With a timeline, a dated layer's tiles wait one render for its day (saved or newest) instead
      // of downloading the newest tiles and then the saved day's; its legend row shows right away
      const waiting = Boolean(onDateRangeChange && info.hasTime && !picked);
      return { layer, info, waiting, time: resolveTime(info, picked ? formatTimelineDate(picked.end) : null, layer.lag ?? 1) };
    });
    // datesKey stands in for dateRanges so a new object with the same days changes nothing
  }, [meta, selection, datesKey]);

  // Each dated layer is its own timeline entry (own dot, colour and remembered day)
  useEffect(() => {
    if (!meta || !onDateRangeChange) return;
    const ids = new Set(selection.split("|"));
    const now = new Set<string>();
    for (const layer of NASA_LAYERS) {
      const info = meta.layers[layer.gibsId];
      if (!ids.has(NASA_PREFIX + layer.id) || !info?.hasTime) continue;
      const days = availableDays(info, layer.lag ?? 1);
      if (!days.length) continue;
      const id = NASA_PREFIX + layer.id;
      now.add(id);
      onDateRangeChange(id, { start: days[0], end: days[days.length - 1] }, { label: layer.title, single: true, availableDates: days });
    }
    reported.current.forEach((id) => !now.has(id) && onDateRangeChange(id, null));
    reported.current = now;
  }, [meta, selection, onDateRangeChange]);
  useEffect(
    () => () => {
      reported.current.forEach((id) => onDateRangeChange?.(id, null));
      reported.current.clear();
    },
    [onDateRangeChange],
  );

  // Tiles: only layers whose date changed are swapped; the rest stay on the map untouched
  useEffect(() => {
    if (!meta) return;
    const wanted = new Map<string, (typeof active)[number] & { i: number }>();
    active.forEach((a, i) => !a.waiting && wanted.set(`${a.info.gibsId}|${a.time ?? ""}`, { ...a, i }));
    tiles.current.forEach((tile, key) => {
      if (!wanted.has(key)) {
        map.removeLayer(tile);
        tiles.current.delete(key);
      }
    });
    wanted.forEach(({ layer, info, time, i }, key) => {
      const existing = tiles.current.get(key);
      const zIndex = layer.imagery ? 4 : 5 + i; // photos under data layers
      if (existing) return existing.setZIndex(zIndex);
      const tile = L.tileLayer(info.template.replace("{time}", time ?? ""), {
        opacity: layer.imagery ? 1 : 0.7,
        attribution: `<a href="${meta.sourceUrl}" target="_blank" rel="noopener">${meta.attribution}</a>`,
        maxNativeZoom: info.maxNativeZoom,
        maxZoom: 19,
        errorTileUrl: BLANK_TILE,
        ...(layer.landOnly ? { bounds: LAND_BOUNDS } : {}),
        zIndex,
      }).addTo(map);
      // Past the native zoom Leaflet stretches tiles; crisp pixels avoid blurry seams between them
      const el = tile.getContainer();
      if (el) el.style.imageRendering = "pixelated";
      if (import.meta.env.DEV) {
        console.debug(`[NasaLayers] ${layer.gibsId} time=${time ?? "none"} maxNativeZoom=${info.maxNativeZoom}`);
        // Leaflet has already swapped in BLANK_TILE here, so rebuild the URL that failed
        tile.on("tileerror", (e) => console.warn("[NasaLayers] tile failed:", tile.getTileUrl((e as L.TileErrorEvent).coords)));
      }
      tiles.current.set(key, tile);
    });
  }, [meta, active, map]);
  useEffect(
    () => () => {
      tiles.current.forEach((tile) => map.removeLayer(tile));
      tiles.current.clear();
    },
    [map],
  );

  // Legend: upper right under the map menu, one row per layer
  const colorsKey = colors ? JSON.stringify(colors) : "";
  useEffect(() => {
    if (!meta || !active.length) return;
    const dateCells = new Map<string, { el: HTMLElement; info: (typeof active)[number]["info"]; text: string }>();
    const build = () => {
      const div = L.DomUtil.create("div", "choropleth-info nasa-legend");
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);

      const h4 = L.DomUtil.create("h4", "", div);
      h4.textContent = "NASA Satellite Data";
      h4.style.cssText = "font-size:13px;margin:0 0 4px";

      for (const { layer, info, time } of active) {
        const color = colors?.[NASA_PREFIX + layer.id];
        const item = L.DomUtil.create("div", "nasa-legend-row", div);
        if (color) item.style.borderColor = color;
        item.classList.toggle("is-folded", folded.current.has(layer.id));

        const top = L.DomUtil.create("div", "nasa-legend-top", item);
        if (color) {
          const dot = L.DomUtil.create("span", "nasa-legend-dot", top);
          dot.style.background = color;
        }
        const title = L.DomUtil.create("span", "nasa-legend-title", top);
        title.textContent = layer.title;
        const fold = L.DomUtil.create("button", "nasa-legend-fold", top) as HTMLButtonElement;
        fold.type = "button";
        const setFoldLabel = () => {
          const isFolded = item.classList.contains("is-folded");
          fold.setAttribute("aria-expanded", String(!isFolded));
          fold.setAttribute("aria-label", `${isFolded ? "Expand" : "Fold"} ${layer.title}`);
          fold.textContent = isFolded ? "\u25B8" : "\u25BE"; // ▸ / ▾
        };
        setFoldLabel();
        // Folding is a class toggle, so tiles and the rest of the legend are not rebuilt.
        // The arrow folds and unfolds; a folded row also opens when clicked anywhere.
        const setFolded = (isFolded: boolean) => {
          item.classList.toggle("is-folded", isFolded);
          if (isFolded) folded.current.add(layer.id);
          else folded.current.delete(layer.id);
          setFoldLabel();
        };
        L.DomEvent.on(fold, "click", (e) => {
          L.DomEvent.stopPropagation(e);
          setFolded(!item.classList.contains("is-folded"));
        });
        L.DomEvent.on(item, "click", () => {
          if (item.classList.contains("is-folded")) setFolded(false);
        });

        const details = L.DomUtil.create("div", "nasa-legend-details", item);
        const note = L.DomUtil.create("div", "", details);
        note.textContent = layer.note;
        note.style.color = "#555";
        if (info.legendUrl) {
          const img = L.DomUtil.create("img", "", details) as HTMLImageElement;
          img.alt = `${layer.title} colour scale`;
          img.style.cssText = "display:block;width:100%;height:auto;margin:4px 0;max-width:none";
          img.onerror = () => img.remove();
          img.src = info.legendUrl;
        }
        const when = L.DomUtil.create("div", "nasa-legend-date", item);
        when.textContent = time || !layer.dataDate ? describeTime(info, time) : `Fixed dataset, ${layer.dataDate}`;
        if (time) dateCells.set(NASA_PREFIX + layer.id, { el: when, info, text: when.textContent });
      }

      const foot = L.DomUtil.create("small", "", div);
      foot.textContent = `Satellite and model estimates, not ground measurements. Source: ${meta.attribution}`;
      foot.style.cssText = "display:block;padding-top:6px;color:#777";
      return div;
    };
    // In the map's right column (scrolls with the sponsored unit); a normal control if there is none
    const rail = getMapRailLegends(map);
    let legend: L.Control | null = null;
    let railEl: HTMLElement | null = null;
    if (rail) {
      railEl = build();
      rail.appendChild(railEl);
    } else {
      legend = new L.Control({ position: "topright" });
      legend.onAdd = build;
      legend.addTo(map);
    }
    // While the timeline bar moves, each row's date follows it (text only; tiles wait for the commit)
    const unsubscribe = subscribeTimelinePreview((preview) => {
      dateCells.forEach((cell, id) => {
        const day = preview?.[id];
        cell.el.textContent = day === undefined ? cell.text : describeTime(cell.info, formatTimelineDate(day));
      });
    });
    return () => {
      unsubscribe();
      railEl?.remove();
      if (legend) map.removeControl(legend);
    };
    // colorsKey stands in for colors (same colours, new object = no rebuild)
  }, [meta, active, colorsKey, map]);

  return null;
};

export default NasaLayers;
