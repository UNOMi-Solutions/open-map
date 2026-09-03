import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { partyClassName } from "@/lib/party-color";
import { CACHE_TTL, cachedApiGet } from "@/lib/apiCache";

/** Gold ring — president */
const RING_PRESIDENT = "#d4af37";
/** Cool silver-blue — vice president */
const RING_VICE = "#8eb4d4";

function defaultDivIcon(ringColor: string) {
  return L.divIcon({
    className: "president-marker",
    html: `<div style="
    width: 30px;
    height: 30px;
    background: linear-gradient(145deg,#1e3a5f,#0c1828);
    border: 2px solid ${ringColor};
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  "></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
}

export type PresidentPin = {
  id: string;
  name: string;
  title?: string;
  party: string;
  description?: string;
  website?: string;
  photoUrl?: string;
  lat: number;
  lng: number;
};

type PresidentFile = {
  president: PresidentPin;
  vicePresident?: PresidentPin;
  source?: string;
  fetchedAt?: string;
};

function ringForPin(pin: PresidentPin) {
  return pin.id.startsWith("vp-") ? RING_VICE : RING_PRESIDENT;
}

function iconForPin(pin: PresidentPin) {
  const ring = ringForPin(pin);
  if (!pin.photoUrl) return defaultDivIcon(ring);
  const safeUrl = pin.photoUrl.replace(/"/g, "&quot;");
  return L.divIcon({
    className: "president-marker-photo",
    html: `<div style="
      width:34px;height:34px;border-radius:50%;overflow:hidden;
      border:2px solid ${ring};box-shadow:0 2px 8px rgba(0,0,0,0.4);
    "><img src="${safeUrl}" alt="" referrerpolicy="no-referrer"
      style="width:100%;height:100%;object-fit:cover;display:block;"
    /></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });
}

function PinPopupBody({ pin }: { pin: PresidentPin }) {
  return (
    <div className="min-w-[200px] max-w-[260px] text-[#0c1022]">
      {pin.photoUrl && (
        <div className="mb-2 w-full rounded bg-neutral-100">
          <img
            src={pin.photoUrl}
            alt=""
            className="max-h-52 w-full rounded object-contain object-center"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
      <div className="text-sm font-semibold leading-snug">{pin.name}</div>
      {pin.title && (
        <div className="mt-0.5 text-xs text-[#0c1022]/85">{pin.title}</div>
      )}
      {pin.description &&
        pin.description.trim() !== pin.title?.trim() && (
          <div className="mt-1 text-xs text-[#0c1022]/80">{pin.description}</div>
        )}
      <div className="mt-1 text-xs">
        <span className="font-medium">Washington, DC</span>
        {pin.party ? (
          <>
            {" · "}
            <span className={partyClassName(pin.party)}>{pin.party}</span>
          </>
        ) : null}
      </div>
      {pin.website && (
        <a
          href={pin.website}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-blue-700 underline"
        >
          Official site
        </a>
      )}
    </div>
  );
}

type PresidentMarkerProps = {
  showPresident?: boolean;
  showVicePresident?: boolean;
  setLoading: (loading: boolean) => void;
};

export default function PresidentMarker({
  showPresident = true,
  showVicePresident = true,
  setLoading
}: PresidentMarkerProps) {
  const [file, setFile] = useState<PresidentFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const path = `/api/v1/politics/president`;
    cachedApiGet<PresidentFile>(
      `politics:president`,
      path,
      CACHE_TTL.POLITICS,
    )
      .then((data) => {
        if (cancelled) return;
        setFile(data);
      })
      .catch((error) => {
        console.error("[PresidentMarkers] Fetch error:", error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      })
    /*
    fetch("/data/president.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load president (${r.status})`);
        return r.json() as Promise<PresidentFile>;
      })
      .then((data) => {
        if (!cancelled) setFile(data);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load president data");
      });
    */
    return () => {
      cancelled = true;
    };
  }, []);

  const pins = useMemo(() => {
    if (!file) return [];
    return [file.president, file.vicePresident]
      .filter(
        (p): p is PresidentPin =>
          p != null && typeof p.lat === "number" && typeof p.lng === "number"
      )
      .filter((p) => {
        const isVp = p.id.startsWith("vp-");
        if (isVp) return showVicePresident;
        return showPresident;
      });
  }, [file, showPresident, showVicePresident]);

  const iconsById = useMemo(() => {
    const m = new Map<string, L.DivIcon>();
    for (const p of pins) m.set(p.id, iconForPin(p));
    return m;
  }, [pins]);

  if (error || pins.length === 0) return null;

  return (
    <>
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.lat, pin.lng]}
          icon={iconsById.get(pin.id) ?? defaultDivIcon(ringForPin(pin))}
          zIndexOffset={pin.id.startsWith("vp-") ? 0 : 750}
        >
          <Popup>
            <PinPopupBody pin={pin} />
          </Popup>
        </Marker>
      ))}
    </>
  );
}
