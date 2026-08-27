import { useEffect, useState } from "react";
import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";

/** Green marker icon for waste treatment/disposal sites */
const WASTE_TREATMENT_ICON = L.divIcon({
  className: "waste-treatment-marker",
  html: `<div style="
    width: 28px;
    height: 28px;
    background: #22c55e;
    border: 2px solid #16a34a;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

/** Facility type IDs to names (matches backend facilityCodes) */
const FACILITY_TYPE_NAMES: Record<number, string> = {
  1: "Hazardous Waste Combustion Facilities",
  3: "Municipal Solid Waste (MSW) Combustion Facilities",
  4: "Medical/Biohazardous Waste Incinerators",
  6: "Municipal Solid Waste (MSW) Landfills",
  9: "Publicly Owned Treatment Works (POTW)",
  10: "Federally Owned Treatment Works (FOTW)",
  16: "Electric Arc Furnaces",
  21: "Commercial Radioactive Waste Disposal Facilities",
  22: "Federal Radioactive Waste Disposal Facilities",
  30: "Industrial Waste Landfills",
  31: "Sewage Sludge Incinerators",
  34: "Composting",
  41: "Sewage Treatment Plants",
  42: "Cement Kilns",
  43: "Industrial Solid Waste Incineration Units",
};

/** Parsed facility from API (GeoJSON Feature or plain object) */
type ParsedFacility = {
  id: string;
  lat: number;
  lon: number;
  name: string;
  facilityType: string;
  address?: string;
  city?: string;
  county?: string;
  state?: string;
  status?: string;
};

/** Extract coordinates from GeoJSON geometry or plain object */
function getCoordsFromFeature(feature: Record<string, unknown>): [number, number] | null {
  // GeoJSON: geometry.coordinates is [lng, lat] for Point
  const geom = feature.geometry as { coordinates?: number[] } | undefined;
  if (geom?.coordinates && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
    const [lng, lat] = geom.coordinates;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  }

  // Plain object
  const props = (feature.properties ?? {}) as Record<string, unknown>;
  const lat = Number(feature.lat ?? feature.latitude ?? props.latitude);
  const lon = Number(feature.lon ?? feature.longitude ?? props.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];

  return null;
}

/** Get facility type display string (EPA API uses facility_type_ids or facility_subtype_ids in properties) */
function getFacilityType(feature: Record<string, unknown>): string {
  const props = (feature.properties ?? {}) as Record<string, unknown>;
  const typeStr = String(
    feature.facility_type ?? feature.facilityType ??
    props.facility_type ?? props.facilityType ?? props.facilityTypeName ?? ""
  ).trim();
  if (typeStr) return typeStr;

  // EPA API: facility_type_ids (number) or facility_subtype_ids (string, e.g. "9")
  const typeId = Number(
    feature.facilityTypeId ?? props.facilityTypeId ?? props.facility_type_id ??
    props.facility_type_ids ?? props.facility_subtype_ids ?? 0
  );
  if (typeId && FACILITY_TYPE_NAMES[typeId]) return FACILITY_TYPE_NAMES[typeId];

  return "—";
}

/** Get facility name (EPA location API often only returns id) */
function getFacilityName(feature: Record<string, unknown>, index: number): string {
  const props = (feature.properties ?? {}) as Record<string, unknown>;
  const name = String(
    feature.name ?? feature.facility_name ?? feature.facilityName ??
    props.name ?? props.facility_name ?? props.facilityName ?? ""
  ).trim();
  if (name) return name;
  const id = props.id ?? feature.id ?? feature.facilityId;
  return id ? String(id) : `Facility #${index + 1}`;
}

/** Build ParsedFacility from backend /facilities item or legacy GeoJSON feature */
function normalizeFacility(item: Record<string, unknown>, index: number, lat: number, lon: number): ParsedFacility {
  const props = (item.properties ?? {}) as Record<string, unknown>;
  const name = String(item.name ?? props.name ?? "").trim() || getFacilityName(item, index);
  const facilityType = String(item.facilityType ?? props.facilityType ?? "").trim() || getFacilityType(item);
  return {
    id: String(item.id ?? props.id ?? `waste-${index}`),
    lat,
    lon,
    name,
    facilityType: facilityType || "—",
    address: String(item.address ?? props.address ?? "").trim() || undefined,
    city: String(item.city ?? props.city ?? "").trim() || undefined,
    county: String(item.county ?? props.county ?? "").trim() || undefined,
    state: String(item.state ?? props.state ?? item.stateCode ?? props.state_code ?? "").trim() || undefined,
    status: String(item.status ?? props.status ?? "").trim() || undefined,
  };
}

type WasteTreatmentDisposalMarkersProps = {
  /** 2-letter state code of the state the user clicked; only this state is fetched */
  selectedStateCode: string | null;
};

const WasteTreatmentDisposalMarkers = ({ selectedStateCode }: WasteTreatmentDisposalMarkersProps) => {
  const [siteData, setSiteData] = useState<ParsedFacility[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedStateCode) {
      setSiteData([]);
      setLoading(false);
      return;
    }
    setSiteData([]);
    setLoading(true);

    let cancelled = false;
    const path = `/api/v1/environment/wasteTreatmentDisposalSites?stateCode=${encodeURIComponent(selectedStateCode)}`;

    cachedApiGet<unknown>(
      `environment:wasteTreatment:${selectedStateCode}`,
      path,
      CACHE_TTL.ENVIRONMENT_STATE,
    )
      .then((data) => {
        if (cancelled) return;
        let rawList: unknown[] = [];
        if (Array.isArray(data)) {
          rawList = data;
        } else if (
          data &&
          typeof data === "object" &&
          Array.isArray((data as Record<string, unknown>).features)
        ) {
          rawList = (data as { features: unknown[] }).features;
        } else if (
          data &&
          typeof data === "object" &&
          Array.isArray((data as Record<string, unknown>).sites)
        ) {
          rawList = (data as { sites: unknown[] }).sites;
        } else if (
          data &&
          typeof data === "object" &&
          Array.isArray((data as Record<string, unknown>).facilities)
        ) {
          rawList = (data as { facilities: unknown[] }).facilities;
        } else if (
          data &&
          typeof data === "object" &&
          Array.isArray((data as Record<string, unknown>).data)
        ) {
          rawList = (data as { data: unknown[] }).data;
        }

        const parsed: ParsedFacility[] = [];
        rawList.forEach((f, index) => {
          const item = f as Record<string, unknown>;
          const lat = Number(item.latitude ?? item.lat);
          const lon = Number(item.longitude ?? item.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            const coords = getCoordsFromFeature(item);
            if (!coords) return;
            const [la, lo] = coords;
            parsed.push(normalizeFacility(item, index, la, lo));
            return;
          }
          parsed.push(normalizeFacility(item, index, lat, lon));
        });
        setSiteData(parsed);
      })
      .catch((error) => {
        console.error("[WasteTreatmentDisposalMarkers] Fetch error:", error);
        if (!cancelled) setSiteData([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStateCode]);

  return (
    <>
      {siteData.map((site) => (
        <Marker key={site.id} position={[site.lat, site.lon]} icon={WASTE_TREATMENT_ICON}>
          {!loading ? (
            <Popup>
              <div className="min-w-0 max-w-[280px] overflow-y-auto overflow-x-hidden break-words">
                <h3 className="text-base font-bold">{site.name}</h3>
                <p className="text-sm mt-1"><strong>Facility Type:</strong> {site.facilityType}</p>
                {site.address && <p className="text-sm"><strong>Address:</strong> {site.address}</p>}
                {(site.county || site.city || site.state) && (
                  <p className="text-sm"><strong>Location:</strong> {[site.city, site.county, site.state].filter(Boolean).join(", ")}</p>
                )}
                {site.status && <p className="text-sm"><strong>Status:</strong> {site.status}</p>}
              </div>
            </Popup>
          ) : (
            <Popup>Loading...</Popup>
          )}
        </Marker>
      ))}
    </>
  );
};

export default WasteTreatmentDisposalMarkers;
