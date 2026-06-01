import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";

/** Distinct from other political pins — violet ring */
const RING = "#6d28d9";

const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="30" height="30" aria-hidden="true"><rect width="100" height="100" rx="8" fill="#ede9fe"/><path fill="#6d28d9" d="M30 38h40v6H30zm0 12h28v6H30zm0 12h34v6H30z"/></svg>`;
const PLACEHOLDER_DATA_URL = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="8" fill="#ede9fe"/></svg>'
)}`;

function placeholderForOnerrorAttr() {
  return PLACEHOLDER_DATA_URL.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

const ICON_FALLBACK = L.divIcon({
  className: "gerrymandering-marker-fallback",
  html: `<div style="
      width:30px;height:30px;border-radius:50%;overflow:hidden;
      border:2px solid ${RING};box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;background:#faf5ff;
    ">${PLACEHOLDER_SVG}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

function gerryIcon(photoUrl: string | undefined) {
  if (!photoUrl?.trim()) return ICON_FALLBACK;
  const safe = photoUrl.replace(/"/g, "&quot;");
  const fb = placeholderForOnerrorAttr();
  return L.divIcon({
    className: "gerrymandering-marker-photo",
    html: `<div style="
      width:30px;height:30px;border-radius:50%;overflow:hidden;
      border:2px solid ${RING};box-shadow:0 2px 6px rgba(0,0,0,0.35);
      background:#faf5ff;
    "><img src="${safe}" alt="" referrerpolicy="no-referrer" width="30" height="30"
      onerror="this.onerror=null;this.src='${fb}';"
      style="width:100%;height:100%;object-fit:cover;display:block;"
    /></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
}

export type GerrymanderingCase = {
  id: string;
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  body: string;
  learnMoreUrl?: string;
};

type GerrymanderingFile = {
  cases: GerrymanderingCase[];
  title?: string;
  sourceNote?: string;
};

function CaseMarker({ c }: { c: GerrymanderingCase }) {
  const [popupImgFailed, setPopupImgFailed] = useState(false);
  useEffect(() => {
    setPopupImgFailed(false);
  }, [c.id, c.imageUrl]);

  const icon = useMemo(() => gerryIcon(c.imageUrl), [c.imageUrl, c.id]);
  const usePlaceholder = !c.imageUrl?.trim() || popupImgFailed;

  return (
    <Marker position={[c.lat, c.lng]} icon={icon} zIndexOffset={400}>
      <Popup>
        <div className="min-w-[220px] max-w-[300px] text-[#0c1022]">
          <div className="mb-2 w-full overflow-hidden rounded bg-neutral-100">
            <img
              src={usePlaceholder ? PLACEHOLDER_DATA_URL : c.imageUrl!}
              alt=""
              className="max-h-48 w-full object-cover object-center"
              referrerPolicy={usePlaceholder ? undefined : "no-referrer"}
              onError={() => {
                if (c.imageUrl?.trim()) setPopupImgFailed(true);
              }}
            />
          </div>
          <div className="text-sm font-semibold leading-snug">{c.title}</div>
          {c.subtitle && (
            <div className="mt-0.5 text-[11px] text-[#0c1022]/70">{c.subtitle}</div>
          )}
          <p className="mt-2 text-xs leading-relaxed text-[#0c1022]/90">{c.body}</p>
          {c.learnMoreUrl && (
            <a
              href={c.learnMoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-blue-700 underline"
            >
              Learn more
            </a>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

export default function GerrymanderingMarkers() {
  const [cases, setCases] = useState<GerrymanderingCase[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/gerrymandering.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load gerrymandering data (${r.status})`);
        return r.json() as Promise<GerrymanderingFile>;
      })
      .then((data) => {
        if (!cancelled) setCases(data.cases ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load gerrymandering data");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return null;

  return (
    <>
      {cases.map((c) => (
        <CaseMarker key={c.id} c={c} />
      ))}
    </>
  );
}
