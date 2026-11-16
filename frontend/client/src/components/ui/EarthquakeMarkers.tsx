import L from "leaflet";
import { useMap } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import { bindZoomScaledRadius, markerBaseRadius } from "@/lib/zoom-scaled-radius";
import {
  getTimelineDateRange,
  isDateInTimelineRange,
  parseTimelineDate,
  type TimelineDateRange,
} from "@/lib/timeline";

// Returned properties from earthquakes api (USGS, past 365 days, M2.5+)
type Earthquake = {
  id: string;
  magnitude: number;
  place: string;
  time: number;
  latitude: number;
  longitude: number;
  depthKm: number;
  feltReports: number | null;
  tsunami: boolean;
};

type EarthquakesResponse = {
  totalEarthquakes?: number;
  earthquakes?: Earthquake[];
};

type EarthquakeMarkersProps = {
  minMagnitude?: number | null;
  setLoading: (loading: boolean) => void;
  timelineRange: TimelineDateRange | null;
  onDateRangeChange: (datasetId: string, range: TimelineDateRange | null) => void;
};

// Gold → crimson by magnitude, so small events read as energy and large ones as danger
const MAGNITUDE_CLASSES = [
  { min: 2.5, label: "2.5–3", color: "#eab308" },
  { min: 3, label: "3–4", color: "#f59e0b" },
  { min: 4, label: "4–5", color: "#ea580c" },
  { min: 5, label: "5+", color: "#9f1239" },
];

function magnitudeColor(magnitude: number): string {
  let color = MAGNITUDE_CLASSES[0].color;
  for (const c of MAGNITUDE_CLASSES) if (magnitude >= c.min) color = c.color;
  return color;
}

// Magnitude is logarithmic, so radius grows exponentially to keep big quakes visually distinct
function magnitudeRadius(magnitude: number): number {
  return Math.max(2, 2 * Math.pow(1.6, magnitude - 2.5));
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function popupHtml(q: Earthquake): string {
  return `
    <div style="min-width:200px;max-width:300px;">
      <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">M ${q.magnitude.toFixed(1)}</h3>
      <p style="margin:0 0 6px;font-size:13px;color:#555;">${q.place}</p>
      <p style="margin:2px 0 0;font-size:12px;"><strong>Time:</strong> ${formatTime(q.time)}</p>
      <p style="margin:2px 0 0;font-size:12px;"><strong>Depth:</strong> ${q.depthKm.toFixed(1)} km</p>
      ${q.feltReports ? `<p style="margin:2px 0 0;font-size:12px;"><strong>Felt reports:</strong> ${q.feltReports.toLocaleString()}</p>` : ""}
      ${q.tsunami ? `<p style="margin:2px 0 0;font-size:12px;"><strong>Tsunami alert issued</strong></p>` : ""}
      <p style="margin:6px 0 0;font-size:12px;">
        <a href="https://earthquake.usgs.gov/earthquakes/eventpage/${encodeURIComponent(q.id)}" target="_blank" rel="noopener noreferrer">View on USGS</a>
      </p>
    </div>`;
}

const EarthquakeMarkers = ({
  minMagnitude = null,
  setLoading,
  timelineRange,
  onDateRangeChange,
}: EarthquakeMarkersProps) => {
  const map = useMap();
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cachedApiGet<EarthquakesResponse>(
      "environment:earthquakes",
      "/api/v1/environment/earthquakes",
      CACHE_TTL.LIVE_HAZARDS,
    )
      .then((data) => {
        if (!cancelled) setEarthquakes(data?.earthquakes ?? []);
      })
      .catch((error) => {
        console.error("[EarthquakeMarkers] Fetch error:", error);
        if (!cancelled) setEarthquakes([]);
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
      "earthquakes",
      getTimelineDateRange(earthquakes.map((quake) => parseTimelineDate(quake.time))),
    );
    return () => onDateRangeChange("earthquakes", null);
  }, [earthquakes, onDateRangeChange]);

  // Smallest first so larger quakes are drawn on top
  const visible = useMemo(
    () =>
      earthquakes
        .filter(
          (q) =>
            (minMagnitude == null || q.magnitude >= minMagnitude) &&
            isDateInTimelineRange(parseTimelineDate(q.time), timelineRange),
        )
        .sort((a, b) => a.magnitude - b.magnitude),
    [earthquakes, minMagnitude, timelineRange],
  );

  useEffect(() => {
    const group = L.layerGroup();
    const scaled: Array<{ marker: L.CircleMarker; baseRadius: number }> = [];
    for (const q of visible) {
      const baseRadius = magnitudeRadius(q.magnitude);
      const marker = L.circleMarker([q.latitude, q.longitude], {
        radius: baseRadius,
        fillColor: magnitudeColor(q.magnitude),
        fillOpacity: 0.8,
        color: "#7c2d12",
        weight: 0.5,
        opacity: 0.6,
      }).bindPopup(() => popupHtml(q), { maxWidth: 320 });
      marker.addTo(group);
      scaled.push({ marker, baseRadius });
    }
    group.addTo(map);
    const unbindZoom = bindZoomScaledRadius(map, scaled);

    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "choropleth-info point-legend");
      const rows = MAGNITUDE_CLASSES.filter(
        (c, i) => minMagnitude == null || (MAGNITUDE_CLASSES[i + 1]?.min ?? Infinity) > minMagnitude,
      )
        .map((c) => {
          const size = markerBaseRadius(magnitudeRadius(c.min + 0.5)) * 2;
          return `<div class="point-legend-row">
            <span class="point-legend-swatch"><i style="width:${size}px;height:${size}px;background:${c.color};"></i></span>
            M ${c.label}
          </div>`;
        })
        .join("");
      div.innerHTML =
        `<h4>Earthquakes, past year</h4>` +
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
  }, [map, visible, minMagnitude]);

  return null;
};

export default EarthquakeMarkers;
