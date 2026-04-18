import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { partyClassName } from "@/lib/party-color";

const SENATOR_ICON = L.divIcon({
  className: "senator-marker",
  html: `<div style="
    width: 26px;
    height: 26px;
    background: #1e3a5f;
    border: 2px solid #c9a227;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 2px 6px rgba(0,0,0,0.35);
  "></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -26],
});

function senatorIcon(photoUrl: string | undefined) {
  if (!photoUrl) return SENATOR_ICON;
  const safe = photoUrl.replace(/"/g, "&quot;");
  return L.divIcon({
    className: "senator-marker-photo",
    html: `<div style="
      width:30px;height:30px;border-radius:50%;overflow:hidden;
      border:2px solid #c9a227;box-shadow:0 2px 6px rgba(0,0,0,0.35);
    "><img src="${safe}" alt="" referrerpolicy="no-referrer"
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
  const icon = useMemo(() => senatorIcon(s.photoUrl), [s.photoUrl, s.id]);

  return (
    <Marker position={[s.lat, s.lng]} icon={icon}>
      <Popup>
        <div className="min-w-[200px] max-w-[260px] text-[#0c1022]">
          {s.photoUrl && (
            <div className="mb-2 w-full rounded bg-neutral-100">
              <img
                src={s.photoUrl}
                alt=""
                className="max-h-52 w-full rounded object-contain object-center"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
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

export default function SenatorMarkers() {
  const [rows, setRows] = useState<SenatorPin[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/senators.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load senators (${r.status})`);
        return r.json() as Promise<SenatorsFile>;
      })
      .then((data) => {
        if (!cancelled) setRows(data.senators ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load senator data");
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
      {rows.map((s) => (
        <SenatorMarkerRow key={s.id} s={s} />
      ))}
    </>
  );
}
