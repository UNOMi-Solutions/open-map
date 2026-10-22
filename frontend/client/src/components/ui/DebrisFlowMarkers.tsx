import L from "leaflet";
import { useMap } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import { formatYearSpan, isoYear, yearInRange } from "@/lib/disaster-incidents";
import { bindZoomScaledRadius, markerBaseRadius } from "@/lib/zoom-scaled-radius";

type DebrisFlow = {
  id: string;
  date: string | null;
  time: string | null;
  state: string | null;
  county: string | null;
  deaths: number;
  injuries: number;
  damage: number;
  latitude: number;
  longitude: number;
};

type DebrisFlowsResponse = {
  debrisFlows?: DebrisFlow[];
};

type DebrisFlowMarkersProps = {
  minYear?: number | null;
  maxYear?: number | null;
  setLoading: (loading: boolean) => void;
};

const DAMAGE_CLASSES = [
  { min: 0, label: "No $ reported", color: "#d4a373" },
  { min: 1, label: "Under $100K", color: "#b08968" },
  { min: 100_000, label: "$100K–$1M", color: "#9c6644" },
  { min: 1_000_000, label: "$1M+", color: "#7f4f24" },
];

function damageColor(damage: number): string {
  let color = DAMAGE_CLASSES[0].color;
  for (const c of DAMAGE_CLASSES) if (damage >= c.min) color = c.color;
  return color;
}

function damageRadius(damage: number): number {
  if (!damage) return 5;
  return Math.max(5, Math.min(14, 4 + 2 * Math.log10(damage)));
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDamage(dollars: number): string {
  if (dollars >= 1e9) return `$${(dollars / 1e9).toFixed(1)}B`;
  if (dollars >= 1e6) return `$${(dollars / 1e6).toFixed(1)}M`;
  if (dollars >= 1e3) return `$${Math.round(dollars / 1e3)}K`;
  return `$${Math.round(dollars)}`;
}

function popupHtml(f: DebrisFlow): string {
  const place = [f.county ? `${f.county} County` : null, f.state].filter(Boolean).join(", ");
  const when = [formatDate(f.date), f.time].filter(Boolean).join(" · ");
  return `
    <div style="min-width:200px;max-width:300px;">
      <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">Debris flow</h3>
      ${place ? `<p style="margin:0 0 6px;font-size:13px;color:#555;">${place}</p>` : ""}
      <p style="margin:2px 0 0;font-size:12px;"><strong>Date:</strong> ${when}</p>
      <p style="margin:2px 0 0;font-size:12px;"><strong>Deaths:</strong> ${f.deaths.toLocaleString()} · <strong>Injuries:</strong> ${f.injuries.toLocaleString()}</p>
      <p style="margin:2px 0 0;font-size:12px;"><strong>Damage:</strong> ${formatDamage(f.damage)}</p>
    </div>`;
}

const DebrisFlowMarkers = ({ minYear = null, maxYear = null, setLoading }: DebrisFlowMarkersProps) => {
  const map = useMap();
  const [flows, setFlows] = useState<DebrisFlow[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cachedApiGet<DebrisFlowsResponse>(
      "environment:debrisFlows",
      "/api/v1/environment/debrisFlows",
      CACHE_TTL.ENVIRONMENT_GLOBAL,
    )
      .then((data) => {
        if (!cancelled) setFlows(data?.debrisFlows ?? []);
      })
      .catch((error) => {
        console.error("[DebrisFlowMarkers] Fetch error:", error);
        if (!cancelled) setFlows([]);
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
      flows
        .filter((f) => yearInRange(isoYear(f.date), minYear, maxYear))
        .sort((a, b) => a.damage - b.damage),
    [flows, minYear, maxYear],
  );

  useEffect(() => {
    const group = L.layerGroup();
    const scaled: Array<{ marker: L.CircleMarker; baseRadius: number }> = [];
    for (const f of visible) {
      const baseRadius = damageRadius(f.damage);
      const marker = L.circleMarker([f.latitude, f.longitude], {
        radius: baseRadius,
        fillColor: damageColor(f.damage),
        fillOpacity: 0.85,
        color: "#3f1d08",
        weight: 0.6,
        opacity: 0.7,
      }).bindPopup(() => popupHtml(f), { maxWidth: 320 });
      marker.addTo(group);
      scaled.push({ marker, baseRadius });
    }
    group.addTo(map);
    const unbindZoom = bindZoomScaledRadius(map, scaled);

    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "choropleth-info point-legend");
      const rows = DAMAGE_CLASSES.map((c) => {
        const size = markerBaseRadius(damageRadius(Math.max(c.min, 1))) * 2;
        return `<div class="point-legend-row">
          <span class="point-legend-swatch"><i style="width:${size}px;height:${size}px;background:${c.color};"></i></span>
          ${c.label}
        </div>`;
      }).join("");
      div.innerHTML =
        `<h4>Debris flows, ${minYear != null && maxYear != null ? formatYearSpan(minYear, maxYear) : "since 2024"}</h4>` +
        rows +
        `<div class="legend-note">${visible.length.toLocaleString()} shown · NOAA</div>`;
      return div;
    };
    legend.addTo(map);

    return () => {
      unbindZoom();
      map.removeLayer(group);
      map.removeControl(legend);
    };
  }, [map, visible, minYear, maxYear]);

  return null;
};

export default DebrisFlowMarkers;
