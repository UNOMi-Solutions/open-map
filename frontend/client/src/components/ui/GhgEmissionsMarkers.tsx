import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";

// Green marker icon to distinguish GHG emissions facilities from other markers 
const GHG_EMISSIONS_ICON = L.divIcon({
  className: "ghg-emissions-marker",
  html: `<div style="
    width: 28px;
    height: 28px;
    background: #16a34a;
    border: 2px solid #15803d;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

// Returned properties from ghg emissions api 
type GhgEmissionFacility = {
  id?: string;
  facilityName?: string;
  industryType?: string; // sectors / industry type
  sectors?: string;
  totalReportedDirectEmissions?: number | string;
  co2EmissionsNonBiogenic?: number | string;
  methaneEmissionsCH4?: number | string;
  nitrousOxideEmissionsN2O?: number | string;
  latitude?: number;
  longitude?: number;
  [key: string]: unknown;
};

type GhgEmissionsMarkersProps = {
  // 2-letter state code of the state the user clicked; only this state's facilities are fetched 
  selectedStateCode: string | null;
  setLoading: (loading: boolean) => void;
};

function formatNumber(value: unknown): string {
  if (typeof value === "number") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (value == null || value === "") return "—";
  return String(value);
}

// Fetch ghg emissions data from api and set state 
const GhgEmissionsMarkers = ({ selectedStateCode, setLoading }: GhgEmissionsMarkersProps) => {
  const [facilities, setFacilities] = useState<GhgEmissionFacility[]>([]);

  useEffect(() => {
    if (!selectedStateCode) {
      setFacilities([]);
      return;
    }

    setFacilities([]);
    setLoading(true);

    let cancelled = false;
    const path = `/api/v1/environment/ghgEmissions?stateCode=${encodeURIComponent(selectedStateCode)}`;

    cachedApiGet<{ ghgEmissions?: GhgEmissionFacility[] }>(
      `environment:ghgEmissions:${selectedStateCode}`,
      path,
      CACHE_TTL.ENVIRONMENT_STATE,
    )
      .then((data) => {
        if (cancelled) return;
        const list = data?.ghgEmissions ?? [];
        setFacilities(Array.isArray(list) ? list : []);
      })
      .catch((error) => {
        console.error("[GhgEmissionsMarkers] Fetch error:", error);
        if (!cancelled) setFacilities([]);
      })
      .finally(() => {
        // Unguarded: re-clicking a state cancels the previous run, which would
        // otherwise leave the app-wide overlay up.
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStateCode]);

  // Don't render anything if no state is selected
  if (!selectedStateCode) {
    return null;
  }

  // While loading and we have no facilities yet, also render nothing to avoid stray markers
  if (facilities.length === 0) {
    return null;
  }

  return (
    <>
      {facilities
        .filter(
          (facility) =>
            typeof facility.latitude === "number" &&
            typeof facility.longitude === "number",
        )
        .map((facility, index) => {
          const {
            latitude,
            longitude,
            facilityName,
            industryType,
            sectors,
            totalReportedDirectEmissions,
            co2EmissionsNonBiogenic,
            methaneEmissionsCH4,
            nitrousOxideEmissionsN2O,
          } = facility;

          return (
            <Marker
              key={facility.id ?? `ghg-facility-${index}`}
              position={[latitude as number, longitude as number]}
              icon={GHG_EMISSIONS_ICON}
            >
              <Popup>
                <div className="min-w-0 max-w-[320px] break-words">
                  <h3 className="text-base font-bold">
                    GHG emissions facility{facilityName ? ` – ${facilityName}` : ""}
                  </h3>
                  <ul className="mt-2 space-y-1 list-none pl-0 text-sm">
                    <li>
                      <strong>Facility Name:</strong>{" "}
                      {String(facilityName ?? "—")}
                    </li>
                    <li>
                      <strong>Industry Type (sectors):</strong>{" "}
                      {String(industryType ?? sectors ?? "—")}
                    </li>
                    <li>
                      <strong>Total reported direct emissions:</strong>{" "}
                      {formatNumber(totalReportedDirectEmissions)}
                    </li>
                    <li>
                      <strong>CO2 emissions (non-biogenic):</strong>{" "}
                      {formatNumber(co2EmissionsNonBiogenic)}
                    </li>
                    <li>
                      <strong>Methane (CH4) emissions:</strong>{" "}
                      {formatNumber(methaneEmissionsCH4)}
                    </li>
                    <li>
                      <strong>Nitrous Oxide (N2O) emissions:</strong>{" "}
                      {formatNumber(nitrousOxideEmissionsN2O)}
                    </li>
                  </ul>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    All emissions values shown are reported in metric tons.
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
    </>
  );
};

export default GhgEmissionsMarkers;

