import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { partyClassName } from "@/lib/party-color";
import { CACHE_TTL, cachedApiGet } from "@/lib/apiCache";

const RING = "#c9a227";

/**
 * Same single-user silhouette as House reps (sign-up style avatar, no plus).
 * Inline SVG on the map avoids any <img> load so it never shows a broken icon.
 */
const SENATOR_USER_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="30" height="30" aria-hidden="true"><rect width="100" height="100" fill="#f3f4f6"/><circle cx="50" cy="36" r="17" fill="#9ca3af"/><path fill="#9ca3af" d="M 16 100 C 16 71 35 54 50 54 C 65 54 84 71 84 100 Z"/></svg>`;

const SENATOR_PLACEHOLDER_DATA_URL = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f3f4f6"/><circle cx="50" cy="36" r="17" fill="#9ca3af"/><path fill="#9ca3af" d="M 16 100 C 16 71 35 54 50 54 C 65 54 84 71 84 100 Z"/></svg>'
)}`;

function senatorPlaceholderForOnerrorAttr() {
  return SENATOR_PLACEHOLDER_DATA_URL.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

const SENATOR_ICON_PLACEHOLDER = L.divIcon({
  className: "senator-marker-placeholder",
  html: `<div style="
      width:30px;height:30px;border-radius:50%;overflow:hidden;
      border:2px solid ${RING};box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;background:#f3f4f6;
    ">${SENATOR_USER_PLACEHOLDER_SVG}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

function senatorIcon(photoUrl: string | undefined) {
  if (!photoUrl?.trim()) return SENATOR_ICON_PLACEHOLDER;
  const safe = photoUrl.replace(/"/g, "&quot;");
  const fallback = senatorPlaceholderForOnerrorAttr();
  return L.divIcon({
    className: "senator-marker-photo",
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

export type SenatorPin = {
  id: string;
  name: string;
  state: string;
  party: string;
  description?: string;
  rank?: string;
  website?: string;
  photoUrl?: string;
  lat: number;
  lng: number;
};

type SenatorsFile = {
  senators: SenatorPin[];
  source?: string;
  fetchedAt?: string;
};

function SenatorMarkerRow({ s }: { s: SenatorPin }) {
  const [popupPhotoFailed, setPopupPhotoFailed] = useState(false);
  useEffect(() => {
    setPopupPhotoFailed(false);
  }, [s.id, s.photoUrl]);

  const icon = useMemo(() => senatorIcon(s.photoUrl), [s.photoUrl, s.id]);

  const usePlaceholder = !s.photoUrl?.trim() || popupPhotoFailed;

  return (
    <Marker position={[s.lat, s.lng]} icon={icon}>
      <Popup>
        <div className="min-w-[200px] max-w-[260px] text-[#0c1022]">
          <div className="mb-2 w-full rounded bg-neutral-100">
            <img
              src={
                usePlaceholder ? SENATOR_PLACEHOLDER_DATA_URL : s.photoUrl!
              }
              alt=""
              className="max-h-52 w-full rounded object-contain object-center"
              referrerPolicy={usePlaceholder ? undefined : "no-referrer"}
              onError={() => {
                if (s.photoUrl?.trim()) setPopupPhotoFailed(true);
              }}
            />
          </div>
          <div className="text-sm font-semibold leading-snug">{s.name}</div>
          {s.description && (
            <div className="mt-1 text-xs text-[#0c1022]/80">{s.description}</div>
          )}
          <div className="mt-1 text-xs">
            <span className="font-medium">{s.state}</span>
            {s.party ? (
              <>
                {" · "}
                <span className={partyClassName(s.party)}>{s.party}</span>
              </>
            ) : null}
            {s.rank ? ` · ${s.rank}` : ""}
          </div>
          {s.website && (
            <a
              href={s.website}
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

export default function SenatorMarkers({setLoading}) {
  const [siteData, setSiteData] = useState<SenatorPin[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSiteData([]);
    setLoading(true);

    let cancelled = false;
    const path = `/api/v1/politics/senators`;
    cachedApiGet<SenatorsFile>(
      `politics:senators`,
      path,
      CACHE_TTL.POLITICS,
    )
      .then((data) => {
        if (cancelled) return;
        setSiteData(data.senators);
      })
      .catch((error) => {
        console.error("[SenatorMarkers] Fetch error:", error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      })
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return null;
  }

  return (
    <>
      {siteData.map((s) => (
        <SenatorMarkerRow key={s.id} s={s} />
      ))}
    </>
  );
}
