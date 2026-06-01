import { GeoJSON } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import type {
  Feature,
  FeatureCollection,
  GeoJsonObject,
  GeoJsonProperties,
  Geometry,
} from "geojson";
import L from "leaflet";
import { geoidToDistrictJoinKey } from "@/lib/district-key";

type DistrictInfo = {
  party: string;
  name: string;
  description?: string;
  website?: string;
};

type PartiesFile = {
  districts: Record<string, DistrictInfo>;
};

export type CongressionalDistrictMode =
  | "red-district"
  | "blue-district"
  | "party-split"
  /** All U.S. House district shapes — neutral styling (e.g. Gerrymandering topic) */
  | "gerry-outline";

type PartyKind = "republican" | "democrat" | "other" | "vacant";

/** Matches GerrymanderingMarkers violet ring — district mesh under educational pins */
const STYLE_GERRY_OUTLINE = {
  fill: "#ede9fe",
  stroke: "#6d28d9",
  fillOpacity: 0.32,
  fillHover: 0.48,
} as const;

const STYLE_RED = {
  fill: "#c92a2a",
  stroke: "#8b1538",
  fillOpacity: 0.45,
  fillHover: 0.65,
} as const;
const STYLE_BLUE = {
  fill: "#1c7ed6",
  stroke: "#1864ab",
  fillOpacity: 0.45,
  fillHover: 0.55,
} as const;
const STYLE_NEUTRAL = {
  fill: "#64748b",
  stroke: "#475569",
  fillOpacity: 0.42,
  fillHover: 0.58,
} as const;

function classifyParty(party: string | undefined): PartyKind {
  if (!party?.trim()) return "vacant";
  const p = party.toLowerCase();
  if (p.includes("republican")) return "republican";
  if (p.includes("democrat")) return "democrat";
  return "other";
}

function matchesMode(mode: "red-district" | "blue-district", party: string): boolean {
  return mode === "red-district"
    ? classifyParty(party) === "republican"
    : classifyParty(party) === "democrat";
}

function partyColor(party: string): string {
  const k = classifyParty(party);
  if (k === "republican") return "#dc2626";
  if (k === "democrat") return "#2563eb";
  if (k === "vacant") return "#64748b";
  return "#0c1022";
}

function styleForKind(kind: PartyKind): {
  fillColor: string;
  color: string;
  fillOpacity: number;
  weight: number;
} {
  if (kind === "republican") {
    return {
      fillColor: STYLE_RED.fill,
      color: STYLE_RED.stroke,
      fillOpacity: STYLE_RED.fillOpacity,
      weight: 1,
    };
  }
  if (kind === "democrat") {
    return {
      fillColor: STYLE_BLUE.fill,
      color: STYLE_BLUE.stroke,
      fillOpacity: STYLE_BLUE.fillOpacity,
      weight: 1,
    };
  }
  return {
    fillColor: STYLE_NEUTRAL.fill,
    color: STYLE_NEUTRAL.stroke,
    fillOpacity: STYLE_NEUTRAL.fillOpacity,
    weight: 1,
  };
}

function hoverStyleForKind(kind: PartyKind): {
  fillColor: string;
  color: string;
  fillOpacity: number;
  weight: number;
} {
  const base = styleForKind(kind);
  const hoverOp =
    kind === "republican"
      ? STYLE_RED.fillHover
      : kind === "democrat"
        ? STYLE_BLUE.fillHover
        : STYLE_NEUTRAL.fillHover;
  return { ...base, fillOpacity: hoverOp, weight: 2 };
}

export default function CongressionalDistrictsLayer({
  mode,
}: {
  mode: CongressionalDistrictMode;
}) {
  const [geo, setGeo] = useState<FeatureCollection<Geometry, GeoJsonProperties> | null>(
    null
  );
  const [parties, setParties] = useState<Record<string, DistrictInfo>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/geo/congressional-119.geojson").then((r) => {
        if (!r.ok) throw new Error(`District shapes (${r.status})`);
        return r.json() as Promise<FeatureCollection<Geometry, GeoJsonProperties>>;
      }),
      fetch("/data/house-district-parties.json").then((r) => {
        if (!r.ok) throw new Error(`House parties (${r.status})`);
        return r.json() as Promise<PartiesFile>;
      }),
    ])
      .then(([fc, p]) => {
        if (!cancelled) {
          setGeo(fc);
          setParties(p.districts ?? {});
        }
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load districts");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!geo?.features?.length) return null;
    if (mode === "party-split" || mode === "gerry-outline") {
      const feats = geo.features.filter((f) => {
        const key = geoidToDistrictJoinKey(
          f.properties?.GEOID as string | undefined
        );
        return Boolean(key);
      });
      return { type: "FeatureCollection" as const, features: feats };
    }
    const feats = geo.features.filter((f) => {
      const key = geoidToDistrictJoinKey(
        f.properties?.GEOID as string | undefined
      );
      if (!key) return false;
      const info = parties[key];
      if (!info?.party) return false;
      return matchesMode(mode, info.party);
    });
    return { type: "FeatureCollection" as const, features: feats };
  }, [geo, parties, mode]);

  const districtStyle = useMemo((): L.StyleFunction<GeoJsonProperties> => {
    return (feature) => {
      if (mode === "red-district" || mode === "blue-district") {
        const fill = mode === "red-district" ? STYLE_RED.fill : STYLE_BLUE.fill;
        const stroke = mode === "red-district" ? STYLE_RED.stroke : STYLE_BLUE.stroke;
        return {
          fillColor: fill,
          fillOpacity: mode === "red-district" ? STYLE_RED.fillOpacity : STYLE_BLUE.fillOpacity,
          color: stroke,
          weight: 1,
        };
      }
      if (mode === "gerry-outline") {
        return {
          fillColor: STYLE_GERRY_OUTLINE.fill,
          fillOpacity: STYLE_GERRY_OUTLINE.fillOpacity,
          color: STYLE_GERRY_OUTLINE.stroke,
          weight: 0.85,
        };
      }
      const key = geoidToDistrictJoinKey(
        feature?.properties?.GEOID as string | undefined
      );
      const info = key ? parties[key] : undefined;
      const kind = classifyParty(info?.party);
      return styleForKind(kind);
    };
  }, [mode, parties]);

  if (error || !filtered?.features?.length) {
    return null;
  }

  /** Remount Leaflet layers when mode or data changes so hover handlers match styling (avoids stale party-split listeners). */
  const geoKey = `${mode}-${filtered.features.length}`;

  return (
    <GeoJSON
      key={geoKey}
      data={filtered as GeoJsonObject}
      style={districtStyle}
      onEachFeature={(feature, layer) => {
        const key = geoidToDistrictJoinKey(
          feature.properties?.GEOID as string | undefined
        );
        const info = key ? parties[key] : undefined;
        const districtLabel =
          (feature.properties?.NAME as string) ?? "Congressional district";
        const party = info?.party ?? "";
        const kind = classifyParty(info?.party);
        const color = partyColor(party);
        const partyLine =
          kind === "vacant"
            ? `<div class="mt-1 text-[11px] text-[#0c1022]/80">No voting member in dataset (e.g. vacant seat).</div>`
            : party
              ? `<div class="mt-1"><span class="font-medium">Party:</span> <span style="color:${color};font-weight:600">${escapeHtml(party)}</span></div>`
              : "";
        const congressLine =
          mode === "gerry-outline"
            ? `<div class="mt-1 text-[10px] text-[#0c1022]/65">119th Congress U.S. House district boundary (Census TIGER).</div>`
            : "";
        const html = `
          <div class="min-w-[180px] max-w-[240px] text-[#0c1022] text-xs">
            <div class="font-semibold leading-snug">${escapeHtml(districtLabel)}</div>
            ${congressLine}
            ${
              info?.name
                ? `<div class="mt-1 text-[11px] text-[#0c1022]/90">${escapeHtml(info.name)}</div>`
                : ""
            }
            ${partyLine}
            ${
              info?.website
                ? `<a class="mt-2 inline-block text-blue-700 underline" href="${escapeAttr(info.website)}" target="_blank" rel="noopener noreferrer">Official site</a>`
                : ""
            }
          </div>`;
        layer.bindPopup(html);
        layer.on("mouseover", () => {
          if (mode === "party-split") {
            (layer as L.Path).setStyle(hoverStyleForKind(kind));
          } else if (mode === "gerry-outline") {
            (layer as L.Path).setStyle({
              weight: 2,
              fillOpacity: STYLE_GERRY_OUTLINE.fillHover,
              color: STYLE_GERRY_OUTLINE.stroke,
              fillColor: STYLE_GERRY_OUTLINE.fill,
            });
          } else {
            const fill = mode === "red-district" ? STYLE_RED.fill : STYLE_BLUE.fill;
            const stroke = mode === "red-district" ? STYLE_RED.stroke : STYLE_BLUE.stroke;
            (layer as L.Path).setStyle({
              weight: 2,
              fillOpacity: mode === "red-district" ? STYLE_RED.fillHover : STYLE_BLUE.fillHover,
              color: stroke,
              fillColor: fill,
            });
          }
        });
        layer.on("mouseout", () => {
          (layer as L.Path).setStyle(districtStyle(feature));
        });
      }}
    />
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string) {
  return s.replace(/"/g, "&quot;");
}
