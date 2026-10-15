import L from "leaflet";
import { useMap } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import { formatYearSpan, isoYear, yearInRange } from "@/lib/disaster-incidents";
import { bindZoomScaledRadius, bindZoomScaledWeight } from "@/lib/zoom-scaled-radius";

type Tornado = {
  id: string;
  date: string | null;
  time: string | null;
  state: string | null;
  county: string | null;
  deaths: number;
  injuries: number;
  damage: number;
  ef: string;
  lengthMiles: number | null;
  widthYards: number | null;
  beginLat: number;
  beginLon: number;
  endLat: number | null;
  endLon: number | null;
};

type TornadoesResponse = {
  dateRange?: { start: string; end: string | null };
  tornadoes?: Tornado[];
};

type TornadoPathsLayerProps = {
  minYear?: number | null;
  maxYear?: number | null;
  setLoading: (loading: boolean) => void;
};

const EF_RANK: Record<string, number> = {
  EFU: 0,
  EF0: 1,
  EF1: 2,
  EF2: 3,
  EF3: 4,
  EF4: 5,
  EF5: 6,
};

const EF_CLASSES = [
  { ef: "EFU", label: "EFU unknown", color: "#9e9e9e" },
  { ef: "EF0", label: "EF0", color: "#fff176" },
  { ef: "EF1", label: "EF1", color: "#ff6f00" },
  { ef: "EF2", label: "EF2", color: "#d50000" },
  { ef: "EF3", label: "EF3", color: "#ff00aa" },
  { ef: "EF4", label: "EF4", color: "#7e57c2" },
  { ef: "EF5", label: "EF5", color: "#311b92" },
];

const EF_COLOR = Object.fromEntries(EF_CLASSES.map((c) => [c.ef, c.color]));

function efColor(ef: string): string {
  return EF_COLOR[ef] ?? EF_COLOR.EFU;
}

function pathWeight(widthYards: number | null): number {
  if (widthYards == null || widthYards <= 0) return 2.5;
  return Math.max(2, Math.min(7, 1.5 + Math.log10(widthYards) * 1.8));
}

function pointRadius(ef: string): number {
  return 3 + (EF_RANK[ef] ?? 0);
}

function isPointTrack(t: Tornado): boolean {
  return t.endLat == null || t.endLon == null || (t.endLat === t.beginLat && t.endLon === t.beginLon);
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

function placeLabel(t: Tornado): string {
  return [t.county ? `${t.county} County` : null, t.state].filter(Boolean).join(", ");
}

function popupHtml(t: Tornado): string {
  const place = placeLabel(t);
  const when = [formatDate(t.date), t.time].filter(Boolean).join(" · ");
  const length = t.lengthMiles != null ? `${t.lengthMiles.toFixed(t.lengthMiles >= 10 ? 0 : 1)} mi` : null;
  const width = t.widthYards != null ? `${Math.round(t.widthYards).toLocaleString()} yd wide` : null;
  const track = [length, width].filter(Boolean).join(" · ");
  return `
    <div style="min-width:200px;max-width:300px;">
      <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">${t.ef} tornado</h3>
      ${place ? `<p style="margin:0 0 6px;font-size:13px;color:#555;">${place}</p>` : ""}
      <p style="margin:2px 0 0;font-size:12px;"><strong>Date:</strong> ${when}</p>
      ${track ? `<p style="margin:2px 0 0;font-size:12px;"><strong>Path:</strong> ${track}</p>` : ""}
      <p style="margin:2px 0 0;font-size:12px;"><strong>Deaths:</strong> ${t.deaths.toLocaleString()} · <strong>Injuries:</strong> ${t.injuries.toLocaleString()}</p>
      <p style="margin:2px 0 0;font-size:12px;"><strong>Damage:</strong> ${formatDamage(t.damage)}</p>
    </div>`;
}

const TornadoPathsLayer = ({ minYear = null, maxYear = null, setLoading }: TornadoPathsLayerProps) => {
  const map = useMap();
  const [tornadoes, setTornadoes] = useState<Tornado[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cachedApiGet<TornadoesResponse>(
      "environment:tornadoes",
      "/api/v1/environment/tornadoes",
      CACHE_TTL.ENVIRONMENT_GLOBAL,
    )
      .then((data) => {
        if (!cancelled) setTornadoes(data?.tornadoes ?? []);
      })
      .catch((error) => {
        console.error("[TornadoPathsLayer] Fetch error:", error);
        if (!cancelled) setTornadoes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Weaker first so violent tracks draw on top
  const visible = useMemo(
    () =>
      tornadoes
        .filter((t) => yearInRange(isoYear(t.date), minYear, maxYear))
        .sort((a, b) => (EF_RANK[a.ef] ?? 0) - (EF_RANK[b.ef] ?? 0)),
    [tornadoes, minYear, maxYear],
  );

  useEffect(() => {
    const group = L.layerGroup();
    const scaledLines: Array<{ layer: L.Polyline; baseWeight: number }> = [];
    const scaledPoints: Array<{ marker: L.CircleMarker; baseRadius: number }> = [];

    for (const t of visible) {
      const color = efColor(t.ef);
      if (isPointTrack(t)) {
        const baseRadius = pointRadius(t.ef);
        const marker = L.circleMarker([t.beginLat, t.beginLon], {
          radius: baseRadius,
          fillColor: color,
          fillOpacity: 0.85,
          color: "#3f1d08",
          weight: 0.6,
          opacity: 0.7,
        }).bindPopup(() => popupHtml(t), { maxWidth: 320 });
        marker.addTo(group);
        scaledPoints.push({ marker, baseRadius });
        continue;
      }

      const baseWeight = pathWeight(t.widthYards);
      const line = L.polyline(
        [
          [t.beginLat, t.beginLon],
          [t.endLat as number, t.endLon as number],
        ],
        {
          color,
          weight: baseWeight,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        },
      ).bindPopup(() => popupHtml(t), { maxWidth: 320 });
      line.on("mouseover", () => line.bringToFront());
      line.addTo(group);
      scaledLines.push({ layer: line, baseWeight });
    }

    group.addTo(map);
    const unbindWeight = bindZoomScaledWeight(map, scaledLines);
    const unbindRadius = bindZoomScaledRadius(map, scaledPoints);

    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "choropleth-info point-legend");
      const rows = EF_CLASSES.map(
        (c) => `<div class="point-legend-row">
          <span class="point-legend-swatch"><i class="point-legend-line" style="background:${c.color};"></i></span>
          ${c.label}
        </div>`,
      ).join("");
      div.innerHTML =
        `<h4>Tornadoes, ${minYear != null && maxYear != null ? formatYearSpan(minYear, maxYear) : "since 2024"}</h4>` +
        rows +
        `<div class="legend-note">${visible.length.toLocaleString()} tracks · NOAA</div>`;
      return div;
    };
    legend.addTo(map);

    return () => {
      unbindWeight();
      unbindRadius();
      map.removeLayer(group);
      map.removeControl(legend);
    };
  }, [map, visible, minYear, maxYear]);

  return null;
};

export default TornadoPathsLayer;
