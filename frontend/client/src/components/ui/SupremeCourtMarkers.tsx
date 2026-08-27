import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";

const RING = "#b8860b";

const JUSTICE_ICON_DEFAULT = L.divIcon({
  className: "scotus-marker",
  html: `<div style="
    width: 30px;
    height: 30px;
    background: linear-gradient(145deg,#3d1a1a,#1a0a0a);
    border: 2px solid ${RING};
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0,0,0,0.35);
  "></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

function justiceIcon(photoUrl: string | undefined) {
  if (!photoUrl) return JUSTICE_ICON_DEFAULT;
  const safe = photoUrl.replace(/"/g, "&quot;");
  return L.divIcon({
    className: "scotus-marker-photo",
    html: `<div style="
      width:30px;height:30px;border-radius:50%;overflow:hidden;
      border:2px solid ${RING};box-shadow:0 2px 6px rgba(0,0,0,0.35);
    "><img src="${safe}" alt="" referrerpolicy="no-referrer"
      style="width:100%;height:100%;object-fit:cover;display:block;"
    /></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
}

export type JusticePin = {
  id: string;
  name: string;
  title: string;
  state: string;
  photoUrl?: string;
  website?: string;
  lat: number;
  lng: number;
};

type SupremeCourtFile = {
  justices: JusticePin[];
  source?: string;
  fetchedAt?: string;
  count?: number;
};

function JusticeMarkerRow({ j, zIndexOffset }: { j: JusticePin; zIndexOffset: number }) {
  const icon = useMemo(() => justiceIcon(j.photoUrl), [j.photoUrl, j.id]);

  return (
    <Marker position={[j.lat, j.lng]} icon={icon} zIndexOffset={zIndexOffset}>
      <Popup>
        <div className="min-w-[200px] max-w-[260px] text-[#0c1022]">
          {j.photoUrl && (
            <div className="mb-2 w-full rounded bg-neutral-100">
              <img
                src={j.photoUrl}
                alt=""
                className="max-h-52 w-full rounded object-contain object-center"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <div className="text-sm font-semibold leading-snug">{j.name}</div>
          <div className="mt-0.5 text-xs text-[#0c1022]/85">{j.title}</div>
          <div className="mt-1 text-xs text-[#0c1022]/70">
            Plotted at a birth/home-state anchor (not the Supreme Court building).
          </div>
          <div className="mt-1 text-xs font-medium text-[#0c1022]">
            {j.state}
          </div>
          {j.website && (
            <a
              href={j.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-blue-700 underline"
            >
              Oyez profile
            </a>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

export default function SupremeCourtMarkers() {
  const [rows, setRows] = useState<JusticePin[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/supreme-court.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load Supreme Court data (${r.status})`);
        return r.json() as Promise<SupremeCourtFile>;
      })
      .then((data) => {
        if (!cancelled) setRows(data.justices ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load Supreme Court data");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return null;

  return (
    <>
      {rows.map((j) => (
        <JusticeMarkerRow
          key={j.id}
          j={j}
          zIndexOffset={j.title.includes("Chief") ? 500 : 0}
        />
      ))}
    </>
  );
}
