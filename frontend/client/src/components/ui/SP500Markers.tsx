import L from "leaflet";
import { useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";
import { CACHE_TTL, cachedApiGet } from "@/lib/apiCache";
import MarkerCompound from "./MarkerCompound";

const SP500_ICON = L.divIcon({
  className: "sp500-marker",
  html: `<div style="
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #fff;
    border-radius: 50%;
    background: #2563eb;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    box-shadow: 0 2px 6px rgba(0,0,0,0.35);
  ">S</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -11],
});

type SP500Company = {
  Symbol: string | null;
  Security: string | null;
  "GICS Sector": string | null;
  "GICS Sub-Industry": string | null;
  "Headquarters Location": string | null;
  "Date first added": string | null;
  CIK: string | null;
  Founded: string | null;
  StockholdersEquity: number | null;
  Geolocation: {
    latitude: number;
    longitude: number;
    zipCode: string;
    city: string | null;
    state: string | null;
  } | null;
};

type SP500Response = {
  count: number;
  companies: SP500Company[];
};

function formatEquity(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SP500Markers({
  setLoading,
}: {
  setLoading: (loading: boolean) => void;
}) {
  const [companies, setCompanies] = useState<SP500Company[]>([]);

  useEffect(() => {
    let cancelled = false;
    setCompanies([]);
    setLoading(true);

    cachedApiGet<SP500Response>(
      "economics:sp500",
      "/api/v1/economics/sp500",
      CACHE_TTL.ECONOMICS,
    )
      .then((response) => {
        if (!Array.isArray(response.companies)) {
          throw new Error("Unexpected response while loading S&P 500 companies");
        }
        if (!cancelled) setCompanies(response.companies);
      })
      .catch((error: unknown) => {
        console.error(
          "[SP500Markers] Fetch error:",
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

  const companiesWithLocations = companies.flatMap((company, index) => {
    const latitude = company.Geolocation?.latitude;
    const longitude = company.Geolocation?.longitude;
    if (
      typeof latitude !== "number" ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      typeof longitude !== "number" ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return [];
    }

    return [{ company, index, latitude, longitude }];
  });

  return (
    <MarkerCompound>
      {companiesWithLocations.map(({ company, index, latitude, longitude }) => {
        const name = company.Security ?? company.Symbol ?? `S&P 500 company ${index + 1}`;
        const location = [
          company.Geolocation?.city,
          company.Geolocation?.state,
        ]
          .filter(Boolean)
          .join(", ");
        const equity = formatEquity(company.StockholdersEquity);

        return (
          <Marker
            key={company.CIK ?? company.Symbol ?? `sp500-${index}`}
            position={[latitude, longitude]}
            icon={SP500_ICON}
          >
            <Popup>
              <div className="min-w-[190px] max-w-[280px] text-sm text-[#0c1022]">
                <h3 className="font-semibold">{name}</h3>
                <dl className="mt-2 space-y-1 text-xs">
                  {company.Symbol && (
                    <div>
                      <dt className="inline font-semibold">Ticker: </dt>
                      <dd className="inline">{company.Symbol}</dd>
                    </div>
                  )}
                  {location && (
                    <div>
                      <dt className="inline font-semibold">Headquarters: </dt>
                      <dd className="inline">{location}</dd>
                    </div>
                  )}
                  {company["GICS Sector"] && (
                    <div>
                      <dt className="inline font-semibold">Sector: </dt>
                      <dd className="inline">{company["GICS Sector"]}</dd>
                    </div>
                  )}
                  {company["GICS Sub-Industry"] && (
                    <div>
                      <dt className="inline font-semibold">Industry: </dt>
                      <dd className="inline">{company["GICS Sub-Industry"]}</dd>
                    </div>
                  )}
                  {equity && (
                    <div>
                      <dt className="inline font-semibold">Stockholders’ equity: </dt>
                      <dd className="inline">{equity}</dd>
                    </div>
                  )}
                  {company.Geolocation?.zipCode && (
                    <div>
                      <dt className="inline font-semibold">ZIP code: </dt>
                      <dd className="inline">{company.Geolocation.zipCode}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MarkerCompound>
  );
}
