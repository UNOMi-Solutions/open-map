import { GeoJSON, useMap } from "react-leaflet";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Feature,
  FeatureCollection,
  GeoJsonObject,
  GeoJsonProperties,
  Geometry,
} from "geojson";
import L from "leaflet";

type ElectoralStateRow = {
  republicanPct: number;
  democratPct: number;
  electoralVotes: number;
};

type ElectoralFile = {
  year: number;
  source?: string;
  note?: string;
  states: Record<string, ElectoralStateRow>;
};

const TERRITORY_NAMES = new Set([
  "American Samoa",
  "Commonwealth of the Northern Mariana Islands",
  "Guam",
  "Puerto Rico",
  "United States Virgin Islands",
]);

function isAlaskaOrHawaii(name: string) {
  return name === "Alaska" || name === "Hawaii";
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

/** Darker = wider Trump vs Harris margin (2024 statewide vote share). */
function styleForState(
  row: ElectoralStateRow | undefined
): L.PathOptions {
  if (!row) {
    return {
      fillColor: "#e2e8f0",
      fillOpacity: 0.35,
      color: "#64748b",
      weight: 0.5,
    };
  }
  const { republicanPct: r, democratPct: d } = row;
  const demWon = d >= r;
  const margin = Math.abs(d - r);
  const t = Math.min(1, margin / 26);

  if (demWon) {
    const light = [191, 219, 254] as const;
    const dark = [29, 78, 216] as const;
    return {
      fillColor: `rgb(${lerp(light[0], dark[0], t)},${lerp(light[1], dark[1], t)},${lerp(light[2], dark[2], t)})`,
      fillOpacity: 0.4 + 0.42 * t,
      color: "#0f172a",
      weight: 0.65,
    };
  }
  const light = [254, 202, 202] as const;
  const dark = [185, 28, 28] as const;
  return {
    fillColor: `rgb(${lerp(light[0], dark[0], t)},${lerp(light[1], dark[1], t)},${lerp(light[2], dark[2], t)})`,
    fillOpacity: 0.4 + 0.42 * t,
    color: "#0f172a",
    weight: 0.65,
  };
}

function ElectoralLegend({ year }: { year: number }) {
  const map = useMap();
  useEffect(() => {
    const ctrl = new L.Control({ position: "bottomright" });
    ctrl.onAdd = () => {
      const div = L.DomUtil.create("div", "electoral-college-legend");
      div.style.cssText = `
        margin: 10px 10px 28px 10px;
        padding: 10px 12px;
        background: rgba(255,255,255,0.94);
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.15);
        font-size: 11px;
        line-height: 1.35;
        max-width: 220px;
        color: #0f172a;
      `;
      div.innerHTML = `
        <div style="font-weight:700;margin-bottom:6px">${year} electoral map</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="width:14px;height:14px;border-radius:3px;background:rgb(185,28,28);display:inline-block"></span>
          <span>Trump won (R)</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="width:14px;height:14px;border-radius:3px;background:rgb(29,78,216);display:inline-block"></span>
          <span>Harris won (D)</span>
        </div>
        <div style="opacity:0.85">Darker shades = larger statewide margin. Alaska &amp; Hawaii: use corner insets (same data).</div>
        <div style="margin-top:6px;opacity:0.75;font-size:10px">ME &amp; NE split some EVs by district; color = statewide plurality.</div>
      `;
      return div;
    };
    ctrl.addTo(map);
    return () => {
      ctrl.remove();
    };
  }, [map, year]);
  return null;
}

export default function ElectoralCollegeStatesLayer() {
  const [statesFc, setStatesFc] = useState<FeatureCollection<
    Geometry,
    GeoJsonProperties
  > | null>(null);
  const [electoral, setElectoral] = useState<ElectoralFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/geo/us-states.geojson").then((r) => {
        if (!r.ok) throw new Error(`States (${r.status})`);
        return r.json() as Promise<FeatureCollection<Geometry, GeoJsonProperties>>;
      }),
      fetch("/data/electoral-college-2024.json").then((r) => {
        if (!r.ok) throw new Error(`Electoral data (${r.status})`);
        return r.json() as Promise<ElectoralFile>;
      }),
    ])
      .then(([fc, el]) => {
        if (!cancelled) {
          setStatesFc(fc);
          setElectoral(el);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Electoral college load failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { contiguousFc, year } = useMemo(() => {
    if (!statesFc?.features?.length || !electoral) {
      return { contiguousFc: null as FeatureCollection<
        Geometry,
        GeoJsonProperties
      > | null, year: electoral?.year ?? 2024 };
    }
    const features = statesFc.features.filter((f) => {
      const name = String(f.properties?.name ?? "").trim();
      if (!name || TERRITORY_NAMES.has(name)) return false;
      if (isAlaskaOrHawaii(name)) return false;
      return true;
    });
    return {
      contiguousFc: { type: "FeatureCollection", features },
      year: electoral.year,
    };
  }, [statesFc, electoral]);

  const styleFn = useCallback(
    (feature?: Feature<Geometry, GeoJsonProperties>) => {
      const name = String(feature?.properties?.name ?? "");
      const row = electoral?.states[name];
      return styleForState(row);
    },
    [electoral]
  );

  const onEach = useCallback(
    (feature: Feature<Geometry, GeoJsonProperties>, layer: L.Layer) => {
      const name = String(feature.properties?.name ?? "State");
      const row = electoral?.states[name];
      const path = layer as L.Path;

      path.on("mouseover", () => {
        path.setStyle({ weight: 2, color: "#0ea5e9" });
      });
      path.on("mouseout", () => {
        path.setStyle(styleForState(row));
      });

      if (!row) {
        path.bindPopup(
          `<div style="font-size:11px;color:#0c1022">${escapeHtml(name)} — no result in dataset</div>`
        );
        return;
      }
      const demWon = row.democratPct >= row.republicanPct;
      const winner = demWon ? "Harris (D)" : "Trump (R)";
      const html = `
        <div style="min-width:180px;max-width:240px;color:#0c1022;font-size:11px;line-height:1.35">
          <div style="font-weight:600">${escapeHtml(name)}</div>
          <div style="margin-top:4px"><span style="font-weight:600">2024 winner:</span> ${escapeHtml(winner)}</div>
          <div style="margin-top:4px"><span style="font-weight:600">Electoral votes:</span> ${row.electoralVotes}</div>
          <div style="margin-top:4px;opacity:0.88">Trump ${row.republicanPct.toFixed(1)}% · Harris ${row.democratPct.toFixed(1)}%</div>
        </div>`;
      path.bindPopup(html);
    },
    [electoral]
  );

  if (error || !contiguousFc?.features?.length) {
    return null;
  }

  return (
    <>
      <GeoJSON
        key={year}
        data={contiguousFc as GeoJsonObject}
        style={styleFn}
        onEachFeature={onEach}
      />
      <ElectoralLegend year={year} />
    </>
  );
}
