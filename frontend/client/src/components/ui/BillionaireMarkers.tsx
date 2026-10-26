import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { CACHE_TTL, cachedApiGet } from "@/lib/apiCache";

const BILLIONAIRE_RING = "#16a34a";
const BILLIONAIRE_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="30" height="30" aria-hidden="true"><rect width="100" height="100" fill="#16a34a"/><circle cx="50" cy="36" r="17" fill="#dcfce7"/><path fill="#dcfce7" d="M 16 100 C 16 71 35 54 50 54 C 65 54 84 71 84 100 Z"/></svg>`;
const BILLIONAIRE_PLACEHOLDER_DATA_URL = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#16a34a"/><circle cx="50" cy="36" r="17" fill="#dcfce7"/><path fill="#dcfce7" d="M 16 100 C 16 71 35 54 50 54 C 65 54 84 71 84 100 Z"/></svg>'
)}`;

const BILLIONAIRE_ICON_PLACEHOLDER = L.divIcon({
  className: "billionaire-marker-placeholder",
  html: `<div style="
      width:30px;height:30px;border-radius:50%;overflow:hidden;
      border:2px solid ${BILLIONAIRE_RING};box-shadow:0 2px 6px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;background:${BILLIONAIRE_RING};
    ">${BILLIONAIRE_PLACEHOLDER_SVG}</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

function billionaireIcon(imageUrl?: string) {
  if (!imageUrl?.trim()) return BILLIONAIRE_ICON_PLACEHOLDER;

  const safeImageUrl = imageUrl
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return L.divIcon({
    className: "billionaire-marker-photo",
    html: `<div style="
      width:30px;height:30px;border-radius:50%;overflow:hidden;
      border:2px solid ${BILLIONAIRE_RING};box-shadow:0 2px 6px rgba(0,0,0,0.35);
      background:${BILLIONAIRE_RING};
    "><img src="${safeImageUrl}" alt="" referrerpolicy="no-referrer" width="30" height="30"
      onerror="this.onerror=null;this.src='${BILLIONAIRE_PLACEHOLDER_DATA_URL}';"
      style="width:100%;height:100%;object-fit:cover;display:block;"
    /></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
}

type BillionaireProfile = {
  uri: string;
  name?: string;
  birthDate?: string;
  family?: boolean;
  gender?: string;
  citizenship?: string;
  residence?: {
    country?: string;
    state?: string;
    city?: string;
    zipCode?: string;
    _geo?: {
      longitude?: number;
      latitude?: number;
    };
  };
  industry?: string[];
  source?: string[];
  image?: string;
  deceased?: boolean;
  children?: number;
  maritalStatus?: string;
  education?: Array<{
    school?: string;
    degree?: string;
  }>;
  organization?: {
    name?: string;
    title?: string;
  };
  selfMade?: {
    _is?: boolean;
    type?: string;
    rank?: number | null;
  };
};

type BillionairesResponse = {
  count: number;
  profiles: BillionaireProfile[];
};

function formatList(values?: string[]) {
  return values?.filter(Boolean).join(", ");
}

function BillionairePopup({
  profile,
  usePlaceholder,
  onImageError,
}: {
  profile: BillionaireProfile;
  usePlaceholder: boolean;
  onImageError: () => void;
}) {
  const residence = profile.residence;
  const education = profile.education
    ?.map(({ school, degree }) => [school, degree].filter(Boolean).join(" — "))
    .filter(Boolean)
    .join("; ");
  const organization = [profile.organization?.title, profile.organization?.name]
    .filter(Boolean)
    .join(" — ");
  const selfMade = profile.selfMade
    ? [
        profile.selfMade._is === undefined
          ? null
          : profile.selfMade._is
            ? "Self-made"
            : "Inherited",
        profile.selfMade.type,
        profile.selfMade.rank == null ? null : `Rank ${profile.selfMade.rank}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  const details = [
    ["Born", profile.birthDate],
    ["Citizenship", profile.citizenship?.toUpperCase()],
    ["Residence", [
      residence?.city,
      residence?.state,
      residence?.zipCode,
      residence?.country?.toUpperCase(),
    ]
      .filter(Boolean)
      .join(", ")],
    ["Industry", formatList(profile.industry)],
    ["Source", formatList(profile.source)],
    ["Family", profile.family === undefined ? null : profile.family ? "Yes" : "No"],
    ["Gender", profile.gender === "m" ? "Male" : profile.gender === "f" ? "Female" : profile.gender],
    ["Children", profile.children],
    ["Marital status", profile.maritalStatus],
    ["Education", education],
    ["Organization", organization],
    ["Self-made", selfMade],
    ["Status", profile.deceased === undefined ? null : profile.deceased ? "Deceased" : "Living"],
  ] as const;

  return (
    <div className="min-w-[210px] max-w-[280px] text-[#0c1022]">
      <div className="mb-2 w-full rounded bg-neutral-100">
        <img
          src={usePlaceholder ? BILLIONAIRE_PLACEHOLDER_DATA_URL : profile.image!}
          alt=""
          className="max-h-52 w-full rounded object-contain object-center"
          referrerPolicy={usePlaceholder ? undefined : "no-referrer"}
          onError={onImageError}
        />
      </div>
      <div className="text-sm font-semibold leading-snug">{profile.name ?? profile.uri}</div>
      <dl className="space-y-1 text-xs">
        {details.map(([label, value]) =>
          value !== null && value !== undefined && value !== "" ? (
            <div key={label}>
              <dt className="inline font-semibold">{label}: </dt>
              <dd className="inline">{value}</dd>
            </div>
          ) : null,
        )}
      </dl>
    </div>
  );
}

function BillionaireMarkerRow({
  profile,
  latitude,
  longitude,
}: {
  profile: BillionaireProfile;
  latitude: number;
  longitude: number;
}) {
  const [popupImageFailed, setPopupImageFailed] = useState(false);
  useEffect(() => {
    setPopupImageFailed(false);
  }, [profile.uri, profile.image]);

  const icon = useMemo(
    () => billionaireIcon(profile.image),
    [profile.image, profile.uri],
  );
  const usePlaceholder = !profile.image?.trim() || popupImageFailed;

  return (
    <Marker position={[latitude, longitude]} icon={icon}>
      <Popup>
        <BillionairePopup
          profile={profile}
          usePlaceholder={usePlaceholder}
          onImageError={() => {
            if (profile.image?.trim()) setPopupImageFailed(true);
          }}
        />
      </Popup>
    </Marker>
  );
}

type BillionaireMarkersProps = {
  setLoading: (loading: boolean) => void;
};

export default function BillionaireMarkers({ setLoading }: BillionaireMarkersProps) {
  const [profiles, setProfiles] = useState<BillionaireProfile[]>([]);

  useEffect(() => {
    let cancelled = false;
    setProfiles([]);
    setLoading(true);

    cachedApiGet<BillionairesResponse>(
      "rtb:billionaires:US:profiles",
      "/api/v1/billionares/",
      CACHE_TTL.POLITICS,
    )
      .then((data) => {
        if (!Array.isArray(data.profiles)) {
          throw new Error("Unexpected response while loading billionaire profiles");
        }
        if (!cancelled) setProfiles(data.profiles);
      })
      .catch((error: unknown) => {
        console.error(
          "[BillionaireMarkers] Fetch error:",
          error instanceof Error ? error.message : error,
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [setLoading]);

  return (
    <>
      {profiles.map((profile) => {
        const latitude = profile.residence?._geo?.latitude;
        const longitude = profile.residence?._geo?.longitude;
        if (
          typeof latitude !== "number" ||
          !Number.isFinite(latitude) ||
          typeof longitude !== "number" ||
          !Number.isFinite(longitude)
        ) {
          return null;
        }

        return (
          <BillionaireMarkerRow
            key={profile.uri}
            profile={profile}
            latitude={latitude}
            longitude={longitude}
          />
        );
      })}
    </>
  );
}
