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

type Volcano = {
  id: string;
  name: string;
  region: string | null;
  observatory: string | null;
  latitude: number;
  longitude: number;
  elevationMeters: number | null;
  threat: string | null;
  alertLevel: string | null;
  aviationColorCode: string | null;
  lastNoticeTime: number | null;
  noticeUrl: string | null;
  volcanoUrl: string | null;
};

type VolcanoesResponse = {
  volcanoes?: Volcano[];
};

type VolcanoMarkersProps = {
  minAlertLevel?: string | null;
  setLoading: (loading: boolean) => void;
  timelineRange: TimelineDateRange | null;
  onDateRangeChange: (datasetId: string, range: TimelineDateRange | null) => void;
};

const ALERT_RANK: Record<string, number> = {
  NORMAL: 0,
  ADVISORY: 1,
  WATCH: 2,
  WARNING: 3,
};

/** Cool crust to hottest lava. Gray stays for volcanoes with no alert. */
const ALERT_CLASSES = [
  { level: null, label: "Unmonitored", color: "#9ca3af", radius: 5 },
  { level: "NORMAL", label: "Normal", color: "#9a3412", radius: 6 },
  { level: "ADVISORY", label: "Advisory", color: "#dc2626", radius: 8 },
  { level: "WATCH", label: "Watch", color: "#f97316", radius: 10 },
  { level: "WARNING", label: "Warning", color: "#facc15", radius: 13 },
];

function alertStyle(level: string | null) {
  return ALERT_CLASSES.find((c) => c.level === level) ?? ALERT_CLASSES[0];
}

function formatTime(ms: number | null): string {
  if (ms == null) return "—";
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

function popupHtml(v: Volcano): string {
  const style = alertStyle(v.alertLevel);
  const links = [
    v.noticeUrl
      ? `<a href="${encodeURI(v.noticeUrl)}" target="_blank" rel="noopener noreferrer">Latest USGS notice</a>`
      : null,
    v.volcanoUrl
      ? `<a href="${encodeURI(v.volcanoUrl)}" target="_blank" rel="noopener noreferrer">Volcano page</a>`
      : null,
  ].filter(Boolean);
  return `
    <div style="min-width:200px;max-width:300px;">
      <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">${v.name}</h3>
      <p style="margin:0 0 6px;font-size:13px;color:#555;">${[v.region, v.observatory].filter(Boolean).join(" · ")}</p>
      <p style="margin:2px 0 0;font-size:12px;"><strong>Alert:</strong> ${style.label}</p>
      ${v.aviationColorCode ? `<p style="margin:2px 0 0;font-size:12px;"><strong>Aviation color:</strong> ${v.aviationColorCode}</p>` : ""}
      ${v.threat ? `<p style="margin:2px 0 0;font-size:12px;"><strong>Threat ranking:</strong> ${v.threat}</p>` : ""}
      ${v.elevationMeters != null ? `<p style="margin:2px 0 0;font-size:12px;"><strong>Elevation:</strong> ${Math.round(v.elevationMeters).toLocaleString()} m</p>` : ""}
      ${v.lastNoticeTime ? `<p style="margin:2px 0 0;font-size:12px;"><strong>Last notice:</strong> ${formatTime(v.lastNoticeTime)}</p>` : ""}
      ${links.length ? `<p style="margin:6px 0 0;font-size:12px;">${links.join(" · ")}</p>` : ""}
    </div>`;
}

const VolcanoMarkers = ({
  minAlertLevel = null,
  setLoading,
  timelineRange,
  onDateRangeChange,
}: VolcanoMarkersProps) => {
  const map = useMap();
  const [volcanoes, setVolcanoes] = useState<Volcano[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cachedApiGet<VolcanoesResponse>(
      "environment:volcanoes",
      "/api/v1/environment/volcanoes",
      CACHE_TTL.LIVE_HAZARDS,
    )
      .then((data) => {
        if (!cancelled) setVolcanoes(data?.volcanoes ?? []);
      })
      .catch((error) => {
        console.error("[VolcanoMarkers] Fetch error:", error);
        if (!cancelled) setVolcanoes([]);
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
      "volcanoes",
      getTimelineDateRange(volcanoes.map((volcano) => parseTimelineDate(volcano.lastNoticeTime))),
    );
    return () => onDateRangeChange("volcanoes", null);
  }, [volcanoes, onDateRangeChange]);

  const visible = useMemo(() => {
    const minRank = minAlertLevel ? (ALERT_RANK[minAlertLevel] ?? 0) : null;
    return volcanoes
      .filter((v) => {
        if (!isDateInTimelineRange(parseTimelineDate(v.lastNoticeTime), timelineRange)) return false;
        if (minRank == null) return true;
        if (!v.alertLevel) return false;
        return (ALERT_RANK[v.alertLevel] ?? -1) >= minRank;
      })
      .sort((a, b) => (ALERT_RANK[a.alertLevel ?? ""] ?? -1) - (ALERT_RANK[b.alertLevel ?? ""] ?? -1));
  }, [volcanoes, minAlertLevel, timelineRange]);

  useEffect(() => {
    const group = L.layerGroup();
    const scaled: Array<{ marker: L.CircleMarker; baseRadius: number }> = [];
    for (const v of visible) {
      const style = alertStyle(v.alertLevel);
      const marker = L.circleMarker([v.latitude, v.longitude], {
        radius: style.radius,
        fillColor: style.color,
        fillOpacity: 0.85,
        color: "#3f1d08",
        weight: 0.6,
        opacity: 0.7,
      }).bindPopup(() => popupHtml(v), { maxWidth: 320 });
      marker.addTo(group);
      scaled.push({ marker, baseRadius: style.radius });
    }
    group.addTo(map);
    const unbindZoom = bindZoomScaledRadius(map, scaled);

    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "choropleth-info point-legend");
      const minRank = minAlertLevel ? (ALERT_RANK[minAlertLevel] ?? 0) : null;
      const rows = ALERT_CLASSES.filter((c) => {
        if (minRank == null) return true;
        if (c.level == null) return false;
        return (ALERT_RANK[c.level] ?? -1) >= minRank;
      })
        .map((c) => {
          const size = markerBaseRadius(c.radius) * 2;
          return `<div class="point-legend-row">
            <span class="point-legend-swatch"><i style="width:${size}px;height:${size}px;background:${c.color};"></i></span>
            ${c.label}
          </div>`;
        })
        .join("");
      div.innerHTML =
        `<h4>Volcanic activity</h4>` +
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
  }, [map, visible, minAlertLevel]);

  return null;
};

export default VolcanoMarkers;
