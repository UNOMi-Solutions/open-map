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

export type CongressionalDistrictMode = "red-district" | "blue-district";

function matchesMode(mode: CongressionalDistrictMode, party: string): boolean {
  const p = party.toLowerCase();
  if (mode === "red-district") return p.includes("republican");
  return p.includes("democrat");
}

function partyColor(party: string): string {
  const p = party.toLowerCase();
  if (p.includes("republican")) return "#dc2626";
  if (p.includes("democrat")) return "#2563eb";
  return "#0c1022";
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

  const districtStyle = useMemo(
    () => (_feature: Feature<Geometry, GeoJsonProperties>) => {
      const fill = mode === "red-district" ? "#c92a2a" : "#1c7ed6";
      const stroke = mode === "red-district" ? "#8b1538" : "#1864ab";
      return {
        fillColor: fill,
        fillOpacity: 0.45,
        color: stroke,
        weight: 1,
      };
    },
    [mode]
  );

  if (error || !filtered?.features?.length) {
    return null;
  }

  return (
    <GeoJSON
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
        const color = partyColor(party);
        const html = `
          <div class="min-w-[180px] max-w-[240px] text-[#0c1022] text-xs">
            <div class="font-semibold leading-snug">${escapeHtml(districtLabel)}</div>
            ${
              info?.name
                ? `<div class="mt-1 text-[11px] text-[#0c1022]/90">${escapeHtml(info.name)}</div>`
                : ""
            }
            ${
              party
                ? `<div class="mt-1"><span class="font-medium">Party:</span> <span style="color:${color};font-weight:600">${escapeHtml(party)}</span></div>`
                : ""
            }
            ${
              info?.website
                ? `<a class="mt-2 inline-block text-blue-700 underline" href="${escapeAttr(info.website)}" target="_blank" rel="noopener noreferrer">Official site</a>`
                : ""
            }
          </div>`;
        layer.bindPopup(html);
        layer.on("mouseover", () => {
          (layer as L.Path).setStyle({
            weight: 2,
            fillOpacity: mode === "red-district" ? 0.65 : 0.55,
            color: mode === "red-district" ? "#8b1538" : "#1864ab",
            fillColor: mode === "red-district" ? "#c92a2a" : "#1c7ed6",
          });
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
