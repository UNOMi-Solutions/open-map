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

const HOUSE_ICON = L.divIcon({
  className: "house-marker",
  html: `<div style="
    width: 26px;
    height: 26px;
    background: #0c4a6e;
    border: 2px solid #14b8a6;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 2px 6px rgba(0,0,0,0.35);
  "></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -26],
});

function houseIcon(photoUrl: string | undefined) {
  if (!photoUrl) return HOUSE_ICON;
  const safe = photoUrl.replace(/"/g, "&quot;");
  return L.divIcon({
    className: "house-marker-photo",
    html: `<div style="
      width:30px;height:30px;border-radius:50%;overflow:hidden;
      border:2px solid #14b8a6;box-shadow:0 2px 6px rgba(0,0,0,0.35);
    "><img src="${safe}" alt="" referrerpolicy="no-referrer"
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
  const icon = useMemo(() => houseIcon(h.photoUrl), [h.photoUrl, h.id]);

  return (
    <Marker position={[h.lat, h.lng]} icon={icon}>
      <Popup>
        <div className="min-w-[200px] max-w-[260px] text-[#0c1022]">
          {h.photoUrl && (
            <div className="mb-2 w-full rounded bg-neutral-100">
              <img
                src={h.photoUrl}
                alt=""
                className="max-h-52 w-full rounded object-contain object-center"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
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
    Promise.all([
      fetch("/geo/congressional-119.geojson").then((r) => {
        if (!r.ok) throw new Error(`District shapes (${r.status})`);
        return r.json() as Promise<FeatureCollection<Geometry, GeoJsonProperties>>;
      }),
      fetch("/data/house-district-parties.json").then((r) => {
        if (!r.ok) throw new Error(`House members (${r.status})`);
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
