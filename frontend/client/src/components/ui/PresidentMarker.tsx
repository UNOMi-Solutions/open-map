import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { partyClassName } from "@/lib/party-color";

const DEFAULT_ICON = L.divIcon({
  className: "president-marker",
  html: `<div style="
    width: 30px;
    height: 30px;
    background: linear-gradient(145deg,#1e3a5f,#0c1828);
    border: 2px solid #d4af37;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

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
  source?: string;
  fetchedAt?: string;
};

function iconFor(photoUrl: string | undefined) {
  if (!photoUrl) return DEFAULT_ICON;
  const safe = photoUrl.replace(/"/g, "&quot;");
  return L.divIcon({
    className: "president-marker-photo",
    html: `<div style="
      width:34px;height:34px;border-radius:50%;overflow:hidden;
      border:2px solid #d4af37;box-shadow:0 2px 8px rgba(0,0,0,0.4);
    "><img src="${safe}" alt="" referrerpolicy="no-referrer"
      style="width:100%;height:100%;object-fit:cover;display:block;"
    /></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });
}

export default function PresidentMarker() {
  const [pin, setPin] = useState<PresidentPin | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/president.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load president (${r.status})`);
        return r.json() as Promise<PresidentFile>;
      })
      .then((data) => {
        if (!cancelled) setPin(data.president ?? null);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load president data");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const icon = useMemo(() => iconFor(pin?.photoUrl), [pin?.photoUrl]);

  if (error || !pin) return null;

  return (
    <Marker position={[pin.lat, pin.lng]} icon={icon}>
      <Popup>
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
      </Popup>
    </Marker>
  );
}
