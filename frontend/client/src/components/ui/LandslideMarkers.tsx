import L from "leaflet";
import { useMap } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import { formatYearSpan, yearInRange } from "@/lib/disaster-incidents";
import { bindZoomScaledRadius, markerBaseRadius } from "@/lib/zoom-scaled-radius";

type Landslide = {
  id: string;
  date: string | null;
  year: number | null;
  kind: string;
  type: string | null;
  fatalities: number;
  confidence: number | null;
  inventory: string | null;
  latitude: number;
  longitude: number;
  url: string | null;
};

type LandslidesResponse = {
  landslides?: Landslide[];
};

type LandslideMarkersProps = {
  minYear?: number | null;
  maxYear?: number | null;
  setLoading: (loading: boolean) => void;
};

const DEFAULT_MIN_YEAR = 2000;

const KIND_CLASSES = [
  { kind: "Landslide", label: "Landslide", color: "#c2410c", radius: 5 },
  { kind: "Debris flow", label: "Debris flow", color: "#9a3412", radius: 5 },
  { kind: "Mudslide", label: "Mudslide", color: "#a16207", radius: 5 },
  { kind: "Rockfall", label: "Rockfall", color: "#57534e", radius: 5 },
  { kind: "Other", label: "Other", color: "#78716c", radius: 4 },
];

function kindStyle(kind: string) {
  return KIND_CLASSES.find((c) => c.kind === kind) ?? KIND_CLASSES[KIND_CLASSES.length - 1];
}

function fatalityRadius(fatalities: number, base: number): number {
  if (!fatalities) return base;
  return Math.min(16, base + 3 + 2 * Math.log10(fatalities + 1));
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function popupHtml(s: Landslide): string {
  const title = s.type || s.kind;
  const sourceLink = s.url
    ? `<p style="margin:6px 0 0;font-size:12px;"><a href="${encodeURI(s.url)}" target="_blank" rel="noopener noreferrer">Source inventory</a></p>`
    : "";
  return `
    <div style="min-width:200px;max-width:300px;">
      <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">${escapeHtml(title)}</h3>
      <p style="margin:0 0 6px;font-size:13px;color:#555;">${escapeHtml(s.kind)}</p>
      <p style="margin:2px 0 0;font-size:12px;"><strong>Date:</strong> ${formatDate(s.date)}</p>
      <p style="margin:2px 0 0;font-size:12px;"><strong>Fatalities:</strong> ${s.fatalities.toLocaleString()}</p>
      ${s.confidence != null ? `<p style="margin:2px 0 0;font-size:12px;"><strong>Confidence:</strong> ${s.confidence}</p>` : ""}
      ${s.inventory ? `<p style="margin:2px 0 0;font-size:12px;"><strong>Inventory:</strong> ${escapeHtml(s.inventory)}</p>` : ""}
      ${sourceLink}
    </div>`;
}

const LandslideMarkers = ({ minYear = null, maxYear = null, setLoading }: LandslideMarkersProps) => {
  const map = useMap();
  const [slides, setSlides] = useState<Landslide[]>([]);
  const sinceYear = minYear ?? DEFAULT_MIN_YEAR;
  const untilYear = maxYear ?? new Date().getFullYear();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cachedApiGet<LandslidesResponse>(
      "environment:landslides",
      "/api/v1/environment/landslides",
      CACHE_TTL.ENVIRONMENT_GLOBAL,
    )
      .then((data) => {
        if (!cancelled) setSlides(data?.landslides ?? []);
      })
      .catch((error) => {
        console.error("[LandslideMarkers] Fetch error:", error);
        if (!cancelled) setSlides([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () =>
      slides
        .filter((s) => s.year == null || yearInRange(s.year, sinceYear, untilYear))
        .sort((a, b) => a.fatalities - b.fatalities),
    [slides, sinceYear, untilYear],
  );

  useEffect(() => {
    const group = L.layerGroup();
    const scaled: Array<{ marker: L.CircleMarker; baseRadius: number }> = [];
    for (const s of visible) {
      const style = kindStyle(s.kind);
      const baseRadius = fatalityRadius(s.fatalities, style.radius);
      const marker = L.circleMarker([s.latitude, s.longitude], {
        radius: baseRadius,
        fillColor: style.color,
        fillOpacity: s.fatalities ? 0.9 : 0.75,
        color: s.fatalities ? "#7f1d1d" : "#3f1d08",
        weight: s.fatalities ? 1 : 0.5,
        opacity: 0.7,
      }).bindPopup(() => popupHtml(s), { maxWidth: 320 });
      marker.addTo(group);
      scaled.push({ marker, baseRadius });
    }
    group.addTo(map);
    const unbindZoom = bindZoomScaledRadius(map, scaled);

    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "choropleth-info point-legend");
      const used = new Set(visible.map((s) => s.kind));
      const rows = KIND_CLASSES.filter((c) => used.has(c.kind))
        .map((c) => {
          const size = markerBaseRadius(c.radius) * 2;
          return `<div class="point-legend-row">
            <span class="point-legend-swatch"><i style="width:${size}px;height:${size}px;background:${c.color};"></i></span>
            ${c.label}
          </div>`;
        })
        .join("");
      div.innerHTML =
        `<h4>Landslides, ${formatYearSpan(sinceYear, untilYear)}</h4>` +
        rows +
        `<div class="legend-note">${visible.length.toLocaleString()} shown · USGS</div>`;
      return div;
    };
    legend.addTo(map);

    return () => {
      unbindZoom();
      map.removeLayer(group);
      map.removeControl(legend);
    };
  }, [map, visible, sinceYear, untilYear]);

  return null;
};

export default LandslideMarkers;
