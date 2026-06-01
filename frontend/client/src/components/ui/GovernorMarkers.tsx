import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { partyClassName } from "@/lib/party-color";

/** Distinct from senators’ gold ring */
const RING = "#166534";

const GOV_USER_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="30" height="30" aria-hidden="true"><rect width="100" height="100" fill="#f3f4f6"/><circle cx="50" cy="36" r="17" fill="#9ca3af"/><path fill="#9ca3af" d="M 16 100 C 16 71 35 54 50 54 C 65 54 84 71 84 100 Z"/></svg>`;

const GOV_PLACEHOLDER_DATA_URL = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f3f4f6"/><circle cx="50" cy="36" r="17" fill="#9ca3af"/><path fill="#9ca3af" d="M 16 100 C 16 71 35 54 50 54 C 65 54 84 71 84 100 Z"/></svg>'
)}`;

function governorPlaceholderForOnerrorAttr() {
  return GOV_PLACEHOLDER_DATA_URL.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

const GOV_ICON_PLACEHOLDER = L.divIcon({
  className: "governor-marker-placeholder",
  html: `<div style="
      width:30px;height:30px;border-radius:50%;overflow:hidden;
      border:2px solid ${RING};box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;background:#f3f4f6;
    ">${GOV_USER_PLACEHOLDER_SVG}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

function governorIcon(photoUrl: string | undefined) {
  if (!photoUrl?.trim()) return GOV_ICON_PLACEHOLDER;
  const safe = photoUrl.replace(/"/g, "&quot;");
  const fallback = governorPlaceholderForOnerrorAttr();
  return L.divIcon({
    className: "governor-marker-photo",
    html: `<div style="
      width:30px;height:30px;border-radius:50%;overflow:hidden;
      border:2px solid ${RING};box-shadow:0 2px 6px rgba(0,0,0,0.35);
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

export type GovernorPin = {
  id: string;
  name: string;
  state: string;
  party: string;
  description?: string;
  website?: string;
  photoUrl?: string;
  lat: number;
  lng: number;
};

type GovernorsFile = {
  governors: GovernorPin[];
  source?: string;
  fetchedAt?: string;
};

function GovernorMarkerRow({ g }: { g: GovernorPin }) {
  const [popupPhotoFailed, setPopupPhotoFailed] = useState(false);
  useEffect(() => {
    setPopupPhotoFailed(false);
  }, [g.id, g.photoUrl]);

  const icon = useMemo(() => governorIcon(g.photoUrl), [g.photoUrl, g.id]);

  const usePlaceholder = !g.photoUrl?.trim() || popupPhotoFailed;

  return (
    <Marker position={[g.lat, g.lng]} icon={icon}>
      <Popup>
        <div className="min-w-[200px] max-w-[260px] text-[#0c1022]">
          <div className="mb-2 w-full rounded bg-neutral-100">
            <img
              src={usePlaceholder ? GOV_PLACEHOLDER_DATA_URL : g.photoUrl!}
              alt=""
              className="max-h-52 w-full rounded object-contain object-center"
              referrerPolicy={usePlaceholder ? undefined : "no-referrer"}
              onError={() => {
                if (g.photoUrl?.trim()) setPopupPhotoFailed(true);
              }}
            />
          </div>
          <div className="text-sm font-semibold leading-snug">{g.name}</div>
          {g.description && (
            <div className="mt-1 text-xs text-[#0c1022]/80">{g.description}</div>
          )}
          <div className="mt-1 text-xs">
            <span className="font-medium">{g.state}</span>
            {g.party ? (
              <>
                {" · "}
                <span className={partyClassName(g.party)}>{g.party}</span>
              </>
            ) : null}
          </div>
          {g.website && (
            <a
              href={g.website}
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

export default function GovernorMarkers() {
  const [rows, setRows] = useState<GovernorPin[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/governors.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load governors (${r.status})`);
        return r.json() as Promise<GovernorsFile>;
      })
      .then((data) => {
        if (!cancelled) setRows(data.governors ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load governor data");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return null;
  }

  return (
    <>
      {rows.map((g) => (
        <GovernorMarkerRow key={g.id} g={g} />
      ))}
    </>
  );
}
