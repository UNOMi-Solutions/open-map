import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
} from "geojson";
import * as turf from "@turf/turf";
import { geoidToDistrictJoinKey } from "@/lib/district-key";
import { partyClassName } from "@/lib/party-color";
import { CACHE_TTL, cachedApiGet } from "@/lib/apiCache";

/**
 * Single-user silhouette (like a “user” / sign-up avatar without the plus).
 * Inline SVG on the map avoids any <img> load so it never shows a broken icon.
 */
const HOUSE_USER_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="30" height="30" aria-hidden="true"><rect width="100" height="100" fill="#f3f4f6"/><circle cx="50" cy="36" r="17" fill="#9ca3af"/><path fill="#9ca3af" d="M 16 100 C 16 71 35 54 50 54 C 65 54 84 71 84 100 Z"/></svg>`;

/** Same artwork as data URL for photo fallbacks and broken GovTrack images */
const HOUSE_REP_PLACEHOLDER_DATA_URL = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f3f4f6"/><circle cx="50" cy="36" r="17" fill="#9ca3af"/><path fill="#9ca3af" d="M 16 100 C 16 71 35 54 50 54 C 65 54 84 71 84 100 Z"/></svg>'
)}`;

/** Escape for use inside onerror="this.src='…'" (data URL is quote-safe after encodeURIComponent) */
function placeholderSrcForOnerrorAttr() {
  return HOUSE_REP_PLACEHOLDER_DATA_URL.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

const HOUSE_ICON_PLACEHOLDER = L.divIcon({
  className: "house-marker-placeholder",
  html: `<div style="
      width:30px;height:30px;border-radius:50%;overflow:hidden;
      border:2px solid #14b8a6;box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;background:#f3f4f6;
    ">${HOUSE_USER_PLACEHOLDER_SVG}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

function houseIcon(photoUrl: string | undefined) {
  if (!photoUrl?.trim()) return HOUSE_ICON_PLACEHOLDER;
  const safe = photoUrl.replace(/"/g, "&quot;");
  const fallback = placeholderSrcForOnerrorAttr();
  return L.divIcon({
    className: "house-marker-photo",
    html: `<div style="
      width:30px;height:30px;border-radius:50%;overflow:hidden;
      border:2px solid #14b8a6;box-shadow:0 2px 6px rgba(0,0,0,0.35);
      background:#f3f4f6;
    "><img src="${safe}" alt="" referrerpolicy="no-referrer" width="30" height="30"
      onerror="this.onerror=null;this.src='${fallback}';"
      style="width:100%;height:100%;object-fit:cover;display:block;"
    /></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
}

export type HousePin = {
  id: string;
  joinKey: string;
  name: string;
  districtLabel: string;
  party: string;
  description?: string;
  website?: string;
  photoUrl?: string;
  lat: number;
  lng: number;
};

type DistrictInfo = {
  party: string;
  name: string;
  description?: string;
  website?: string;
  photoUrl?: string;
};

type PartiesFile = {
  districts: Record<string, DistrictInfo>;
};

function HouseMarkerRow({ h }: { h: HousePin }) {
  const [popupPhotoFailed, setPopupPhotoFailed] = useState(false);
  useEffect(() => {
    setPopupPhotoFailed(false);
  }, [h.id, h.photoUrl]);

  const icon = useMemo(() => houseIcon(h.photoUrl), [h.photoUrl, h.id]);

  const usePlaceholder =
    !h.photoUrl?.trim() || popupPhotoFailed;

  return (
    <Marker position={[h.lat, h.lng]} icon={icon}>
      <Popup>
        <div className="min-w-[200px] max-w-[260px] text-[#0c1022]">
          <div className="mb-2 w-full rounded bg-neutral-100">
            <img
              src={
                usePlaceholder
                  ? HOUSE_REP_PLACEHOLDER_DATA_URL
                  : h.photoUrl!
              }
              alt=""
              className="max-h-52 w-full rounded object-contain object-center"
              referrerPolicy={usePlaceholder ? undefined : "no-referrer"}
              onError={() => {
                if (h.photoUrl?.trim()) setPopupPhotoFailed(true);
              }}
            />
          </div>
          <div className="text-sm font-semibold leading-snug">{h.name}</div>
          <div className="mt-0.5 text-xs text-[#0c1022]/85">{h.districtLabel}</div>
          {h.description && (
            <div className="mt-1 text-xs text-[#0c1022]/80">{h.description}</div>
          )}
          <div className="mt-1 text-xs">
            {h.party ? (
              <span className={partyClassName(h.party)}>{h.party}</span>
            ) : null}
          </div>
          {h.website && (
            <a
              href={h.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-blue-700 underline"
            >
              Official site
            </a>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

export default function HouseMarkers() {
  const [geo, setGeo] = useState<FeatureCollection<
    Geometry,
    GeoJsonProperties
  > | null>(null);
  const [parties, setParties] = useState<Record<string, DistrictInfo>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const path = `api/v1/politics/representatives`
    Promise.all([
      fetch("/geo/congressional-119.geojson").then((r) => {
        if (!r.ok) throw new Error(`District shapes (${r.status})`);
        return r.json() as Promise<FeatureCollection<Geometry, GeoJsonProperties>>;
      }),
      /*
      fetch("/data/house-district-parties.json").then((r) => {
        if (!r.ok) throw new Error(`House members (${r.status})`);
        return r.json() as Promise<PartiesFile>;
      }),
      */
      cachedApiGet<PartiesFile>(
        `politics:houseOfReps`,
        path,
        CACHE_TTL.POLITICS,
      )
    ])
      .then(([fc, p]) => {
        if (!cancelled) {
          setGeo(fc);
          setParties(p.districts ?? {});
        }
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load House data");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pins = useMemo(() => {
    if (!geo?.features?.length || !Object.keys(parties).length) return [];
    const out: HousePin[] = [];
    for (const f of geo.features) {
      const key = geoidToDistrictJoinKey(f.properties?.GEOID as string | undefined);
      if (!key) continue;
      const info = parties[key];
      if (!info?.name) continue;
      try {
        const c = turf.centroid(f as Feature<Geometry>);
        const coords = c.geometry.coordinates;
        const lng = coords[0];
        const lat = coords[1];
        if (typeof lat !== "number" || typeof lng !== "number") continue;
        const label =
          (f.properties?.NAME as string) ?? `District ${key}`;
        out.push({
          id: `house-${key}`,
          joinKey: key,
          name: info.name,
          districtLabel: label,
          party: info.party,
          description: info.description,
          website: info.website,
          photoUrl: info.photoUrl,
          lat,
          lng,
        });
      } catch {
        /* skip bad geometry */
      }
    }
    return out;
  }, [geo, parties]);

  if (error) {
    return null;
  }

  return (
    <>
      {pins.map((h) => (
        <HouseMarkerRow key={h.id} h={h} />
      ))}
    </>
  );
}
