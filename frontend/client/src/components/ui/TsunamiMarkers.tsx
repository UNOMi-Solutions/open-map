import L from "leaflet";
import { useMap } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import { formatYearSpan, yearInRange } from "@/lib/disaster-incidents";
import { bindZoomScaledRadius, markerBaseRadius } from "@/lib/zoom-scaled-radius";

type TsunamiRunup = {
  id: number;
  eventId: number;
  date: string;
  year: number;
  location: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
  runupHeightM: number | null;
  cause: string | null;
  sourceMagnitude: number | null;
  distanceFromSourceKm: number | null;
};

type TsunamisResponse = {
  startYear?: number;
  runups?: TsunamiRunup[];
};

type TsunamiMarkersProps = {
  minYear?: number | null;
  maxYear?: number | null;
  setLoading: (loading: boolean) => void;
};

/** Catalog goes back to 1900; default to this century unless the sidebar asks for older runups. */
const DEFAULT_MIN_YEAR = 2000;

const HEIGHT_CLASSES = [
  { min: 0, label: "Observed / <0.5 m", color: "#9ecae1", radius: 4 },
  { min: 0.5, label: "0.5–1 m", color: "#6baed6", radius: 6 },
  { min: 1, label: "1–3 m", color: "#3182bd", radius: 8 },
  { min: 3, label: "3–10 m", color: "#08519c", radius: 11 },
  { min: 10, label: "10 m+", color: "#08306b", radius: 14 },
];

function heightStyle(meters: number | null) {
  if (meters == null || meters < 0.5) return HEIGHT_CLASSES[0];
  let match = HEIGHT_CLASSES[0];
  for (const c of HEIGHT_CLASSES) if (meters >= c.min) match = c;
  return match;
}

function popupHtml(r: TsunamiRunup): string {
  const place = [r.location, r.state].filter(Boolean).join(", ");
  return `
    <div style="min-width:200px;max-width:300px;">
      <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">Tsunami runup</h3>
      <p style="margin:0 0 6px;font-size:13px;color:#555;">${place || "US coast"}</p>
      <p style="margin:2px 0 0;font-size:12px;"><strong>Date:</strong> ${r.date}</p>
      <p style="margin:2px 0 0;font-size:12px;"><strong>Runup height:</strong> ${r.runupHeightM != null ? `${r.runupHeightM.toFixed(1)} m` : "observed"}</p>
      ${r.cause ? `<p style="margin:2px 0 0;font-size:12px;"><strong>Cause:</strong> ${r.cause}</p>` : ""}
      ${r.sourceMagnitude != null ? `<p style="margin:2px 0 0;font-size:12px;"><strong>Source magnitude:</strong> ${r.sourceMagnitude.toFixed(1)}</p>` : ""}
      ${r.distanceFromSourceKm != null ? `<p style="margin:2px 0 0;font-size:12px;"><strong>Distance from source:</strong> ${r.distanceFromSourceKm.toLocaleString()} km</p>` : ""}
    </div>`;
}

const TsunamiMarkers = ({ minYear = null, maxYear = null, setLoading }: TsunamiMarkersProps) => {
  const map = useMap();
  const [runups, setRunups] = useState<TsunamiRunup[]>([]);
  const sinceYear = minYear ?? DEFAULT_MIN_YEAR;
  const untilYear = maxYear ?? new Date().getFullYear();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cachedApiGet<TsunamisResponse>(
      "environment:tsunamis",
      "/api/v1/environment/tsunamis",
      CACHE_TTL.ENVIRONMENT_GLOBAL,
    )
      .then((data) => {
        if (!cancelled) setRunups(data?.runups ?? []);
      })
      .catch((error) => {
        console.error("[TsunamiMarkers] Fetch error:", error);
        if (!cancelled) setRunups([]);
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
      runups
        .filter((r) => yearInRange(r.year, sinceYear, untilYear))
        .sort((a, b) => (a.runupHeightM ?? 0) - (b.runupHeightM ?? 0)),
    [runups, sinceYear, untilYear],
  );

  useEffect(() => {
    const group = L.layerGroup();
    const scaled: Array<{ marker: L.CircleMarker; baseRadius: number }> = [];
    for (const r of visible) {
      const style = heightStyle(r.runupHeightM);
      const marker = L.circleMarker([r.latitude, r.longitude], {
        radius: style.radius,
        fillColor: style.color,
        fillOpacity: 0.75,
        color: "#08306b",
        weight: 0.5,
        opacity: 0.65,
      }).bindPopup(() => popupHtml(r), { maxWidth: 320 });
      marker.addTo(group);
      scaled.push({ marker, baseRadius: style.radius });
    }
    group.addTo(map);
    const unbindZoom = bindZoomScaledRadius(map, scaled);

    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "choropleth-info point-legend");
      const rows = HEIGHT_CLASSES.map((c) => {
        const size = markerBaseRadius(c.radius) * 2;
        return `<div class="point-legend-row">
          <span class="point-legend-swatch"><i style="width:${size}px;height:${size}px;background:${c.color};"></i></span>
          ${c.label}
        </div>`;
      }).join("");
      div.innerHTML =
        `<h4>Tsunami runups, ${formatYearSpan(sinceYear, untilYear)}</h4>` +
        rows +
        `<div class="legend-note">${visible.length.toLocaleString()} shown · NOAA NCEI</div>`;
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

export default TsunamiMarkers;
