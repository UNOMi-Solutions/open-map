import L from "leaflet";
import { useMap } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import { formatYearSpan } from "@/lib/disaster-incidents";
import { bindZoomScaledRadius, markerBaseRadius } from "@/lib/zoom-scaled-radius";
import {
  getTimelineDateRange,
  getTimelineYearRange,
  isDateInTimelineRange,
  parseTimelineDate,
  type TimelineDateRange,
} from "@/lib/timeline";

// Returned properties from wildfires api (NIFC WFIGS, 100+ acres since 2024)
type Wildfire = {
  id: string;
  name: string;
  discovered: number;
  contained: number | null;
  acres: number;
  percentContained: number | null;
  cause: string | null;
  state: string;
  county: string | null;
  personnel: number | null;
  latitude: number;
  longitude: number;
};

type WildfiresResponse = {
  dateRange?: { start: string; end: string };
  fires?: Wildfire[];
};

type WildfireMarkersProps = {
  minAcres?: number | null;
  setLoading: (loading: boolean) => void;
  timelineRange: TimelineDateRange | null;
  onDateRangeChange: (datasetId: string, range: TimelineDateRange | null) => void;
};

const SIZE_CLASSES = [
  { min: 100, label: "100–1K acres", color: "#fdb863" },
  { min: 1_000, label: "1K–10K acres", color: "#f98e2b" },
  { min: 10_000, label: "10K–100K acres", color: "#e0570f" },
  { min: 100_000, label: "100K+ acres", color: "#a33006" },
];

function sizeColor(acres: number): string {
  let color = SIZE_CLASSES[0].color;
  for (const c of SIZE_CLASSES) if (acres >= c.min) color = c.color;
  return color;
}

// Burned area spans four orders of magnitude, so radius follows log10(acres)
function sizeRadius(acres: number): number {
  return Math.max(2, 2 + 2.5 * (Math.log10(Math.max(acres, 100)) - 2));
}

function formatDate(ms: number | null): string {
  if (ms == null) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function popupHtml(f: Wildfire): string {
  const place = [f.county ? `${f.county} County` : null, f.state].filter(Boolean).join(", ");
  return `
    <div style="min-width:200px;max-width:300px;">
      <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">${f.name} Fire</h3>
      <p style="margin:0 0 6px;font-size:13px;color:#555;">${place}</p>
      <p style="margin:2px 0 0;font-size:12px;"><strong>Size:</strong> ${f.acres.toLocaleString()} acres</p>
      <p style="margin:2px 0 0;font-size:12px;"><strong>Discovered:</strong> ${formatDate(f.discovered)}</p>
      ${f.contained ? `<p style="margin:2px 0 0;font-size:12px;"><strong>Contained:</strong> ${formatDate(f.contained)}</p>` : ""}
      ${f.percentContained != null ? `<p style="margin:2px 0 0;font-size:12px;"><strong>Containment:</strong> ${f.percentContained}%</p>` : ""}
      ${f.cause ? `<p style="margin:2px 0 0;font-size:12px;"><strong>Cause:</strong> ${f.cause}</p>` : ""}
      ${f.personnel ? `<p style="margin:2px 0 0;font-size:12px;"><strong>Personnel:</strong> ${f.personnel.toLocaleString()}</p>` : ""}
    </div>`;
}

const WildfireMarkers = ({
  minAcres = null,
  setLoading,
  timelineRange,
  onDateRangeChange,
}: WildfireMarkersProps) => {
  const map = useMap();
  const [fires, setFires] = useState<Wildfire[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cachedApiGet<WildfiresResponse>(
      "environment:wildfires",
      "/api/v1/environment/wildfires",
      CACHE_TTL.LIVE_HAZARDS,
    )
      .then((data) => {
        if (!cancelled) setFires(data?.fires ?? []);
      })
      .catch((error) => {
        console.error("[WildfireMarkers] Fetch error:", error);
        if (!cancelled) setFires([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onDateRangeChange(
      "wildfires",
      getTimelineDateRange(fires.map((fire) => parseTimelineDate(fire.discovered))),
    );
    return () => onDateRangeChange("wildfires", null);
  }, [fires, onDateRangeChange]);

  const timelineYears = getTimelineYearRange(timelineRange);

  // Smallest first so larger fires are drawn on top
  const visible = useMemo(
    () =>
      fires
        .filter(
          (f) =>
            (minAcres == null || f.acres >= minAcres) &&
            isDateInTimelineRange(parseTimelineDate(f.discovered), timelineRange),
        )
        .sort((a, b) => a.acres - b.acres),
    [fires, minAcres, timelineRange],
  );

  useEffect(() => {
    const group = L.layerGroup();
    const scaled: Array<{ marker: L.CircleMarker; baseRadius: number }> = [];
    for (const f of visible) {
      const baseRadius = sizeRadius(f.acres);
      const marker = L.circleMarker([f.latitude, f.longitude], {
        radius: baseRadius,
        fillColor: sizeColor(f.acres),
        fillOpacity: 0.8,
        color: "#5a1d02",
        weight: 0.5,
        opacity: 0.6,
      }).bindPopup(() => popupHtml(f), { maxWidth: 320 });
      marker.addTo(group);
      scaled.push({ marker, baseRadius });
    }
    group.addTo(map);
    const unbindZoom = bindZoomScaledRadius(map, scaled);

    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "choropleth-info point-legend");
      const rows = SIZE_CLASSES.filter(
        (c, i) => minAcres == null || (SIZE_CLASSES[i + 1]?.min ?? Infinity) > minAcres,
      )
        .map((c) => {
          const size = markerBaseRadius(sizeRadius(c.min * 3)) * 2;
          return `<div class="point-legend-row">
            <span class="point-legend-swatch"><i style="width:${size}px;height:${size}px;background:${c.color};"></i></span>
            ${c.label}
          </div>`;
        })
        .join("");
      div.innerHTML =
        `<h4>Wildfires, ${timelineYears ? formatYearSpan(timelineYears.min, timelineYears.max) : "since 2024"}</h4>` +
        rows +
        `<div class="legend-note">${visible.length.toLocaleString()} shown · NIFC</div>`;
      return div;
    };
    legend.addTo(map);

    return () => {
      unbindZoom();
      map.removeLayer(group);
      map.removeControl(legend);
    };
  }, [map, visible, minAcres, timelineYears?.min, timelineYears?.max]);

  return null;
};

export default WildfireMarkers;
