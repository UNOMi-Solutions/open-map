import L from "leaflet";
import { useMap } from "react-leaflet";
import { useEffect, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import { COUNTY_CHOROPLETH_STYLE, useCountyFeatures } from "@/lib/county-choropleth";

// Per hazard: [risk score 0-100, rating index, expected annual loss $, annualized frequency]
type HazardValues = [number | null, number, number | null, number | null];

type CountyRisk = {
  name: string;
  state: string;
  riskScore: number | null;
  riskRating: number;
  expectedAnnualLoss: number | null;
  socialVulnerability: number;
  communityResilience: number;
  hazards: Record<string, HazardValues>;
};

type NationalRiskIndexResponse = {
  version?: string;
  hazards?: Record<string, string>;
  ratings?: string[];
  counties?: Record<string, CountyRisk>;
};

type NationalRiskIndexLayerProps = {
  selectedHazard?: string | null;
  setLoading: (loading: boolean) => void;
};

// Indexes match the backend's NRI_RATINGS; the five FEMA classes use the health layers' white → red reds
const RATING_COLORS: Record<string, string> = {
  "Very Low": "#ffc9c4",
  "Relatively Low": "#fc9a91",
  "Relatively Moderate": "#f0685c",
  "Relatively High": "#d8342c",
  "Very High": "#a8141f",
  "No Rating": "#ffffff",
  "Not Applicable": "#ffffff",
  "Insufficient Data": "#e5e7eb",
};

const LEGEND_ROWS: Array<{ label: string; color: string }> = [
  { label: "Very High", color: RATING_COLORS["Very High"] },
  { label: "Relatively High", color: RATING_COLORS["Relatively High"] },
  { label: "Relatively Moderate", color: RATING_COLORS["Relatively Moderate"] },
  { label: "Relatively Low", color: RATING_COLORS["Relatively Low"] },
  { label: "Very Low", color: RATING_COLORS["Very Low"] },
  { label: "No rating / not applicable", color: RATING_COLORS["Not Applicable"] },
  { label: "Insufficient data", color: RATING_COLORS["Insufficient Data"] },
];

function formatDollars(dollars: number | null): string {
  if (dollars == null) return "—";
  if (dollars >= 1e9) return `$${(dollars / 1e9).toFixed(1)}B`;
  if (dollars >= 1e6) return `$${(dollars / 1e6).toFixed(1)}M`;
  if (dollars >= 1e3) return `$${Math.round(dollars / 1e3)}K`;
  return `$${Math.round(dollars)}`;
}

function formatFrequency(perYear: number | null): string {
  if (perYear == null || perYear <= 0) return "—";
  if (perYear >= 1) return `${perYear.toFixed(1)} per year`;
  const years = Math.round(1 / perYear);
  return years > 10000 ? "less than once per 10,000 years" : `about once every ${years.toLocaleString()} years`;
}

const NationalRiskIndexLayer = ({ selectedHazard = null, setLoading }: NationalRiskIndexLayerProps) => {
  const map = useMap();
  const countyFeatures = useCountyFeatures();
  const [data, setData] = useState<NationalRiskIndexResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cachedApiGet<NationalRiskIndexResponse>(
      "environment:nationalRiskIndex",
      "/api/v1/environment/nationalRiskIndex",
      CACHE_TTL.ENVIRONMENT_GLOBAL,
    )
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((error) => {
        console.error("[NationalRiskIndexLayer] Fetch error:", error);
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (countyFeatures.length === 0 || !data?.counties) return;
    const counties = data.counties;
    const ratings = data.ratings ?? [];
    const hazardNames = data.hazards ?? {};
    const hazardName = selectedHazard ? hazardNames[selectedHazard] ?? selectedHazard : null;

    // Missing hazard entries mean the hazard cannot occur in that county
    const ratingLabel = (fips: string): string => {
      const county = counties[fips];
      if (!county) return "Insufficient Data";
      if (!selectedHazard) return ratings[county.riskRating] ?? "Insufficient Data";
      const hazard = county.hazards[selectedHazard];
      return hazard ? ratings[hazard[1]] ?? "Insufficient Data" : "Not Applicable";
    };

    const popupHtml = (fips: string, label: string): string => {
      const county = counties[fips];
      if (!county) {
        return `<div style="min-width:200px;"><h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">${label}</h3>
          <p style="font-size:13px;color:#888;">No National Risk Index data.</p></div>`;
      }
      const line = (name: string, value: string) =>
        `<p style="margin:2px 0 0;font-size:12px;"><strong>${name}:</strong> ${value}</p>`;

      let selectedSection = "";
      if (selectedHazard) {
        const hazard = county.hazards[selectedHazard];
        selectedSection = hazard
          ? `<div style="margin:6px 0;padding:6px;background:#fff0ee;border-radius:4px;">
              <p style="margin:0;font-size:13px;font-weight:700;">${hazardName}: ${ratings[hazard[1]]}</p>
              ${line("Risk score", hazard[0] != null ? `${hazard[0].toFixed(1)} / 100` : "—")}
              ${line("Expected annual loss", formatDollars(hazard[2]))}
              ${line("Historical frequency", formatFrequency(hazard[3]))}
            </div>`
          : `<p style="margin:6px 0;font-size:12px;color:#555;">${hazardName} does not occur in this county.</p>`;
      }

      const topHazards = Object.entries(county.hazards)
        .filter(([, h]) => h[0] != null && h[1] <= 4)
        .sort((a, b) => (b[1][0] ?? 0) - (a[1][0] ?? 0))
        .slice(0, 5)
        .map(
          ([code, h]) => `<tr>
            <td style="padding:1px 8px 1px 0;">${hazardNames[code] ?? code}</td>
            <td style="padding:1px 8px 1px 0;">${ratings[h[1]]}</td>
            <td style="text-align:right;">${formatDollars(h[2])}/yr</td>
          </tr>`,
        )
        .join("");

      return `
        <div style="min-width:220px;max-width:320px;">
          <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">${label}</h3>
          ${line("Overall risk", `${ratings[county.riskRating]}${county.riskScore != null ? ` (${county.riskScore.toFixed(1)} / 100)` : ""}`)}
          ${line("Expected annual loss", formatDollars(county.expectedAnnualLoss))}
          ${line("Social vulnerability", ratings[county.socialVulnerability])}
          ${line("Community resilience", ratings[county.communityResilience])}
          ${selectedSection}
          ${topHazards ? `<p style="margin:6px 0 2px;font-size:12px;font-weight:700;">Top hazards by risk</p>
            <table style="font-size:12px;border-collapse:collapse;">${topHazards}</table>` : ""}
          <p style="margin:6px 0 0;font-size:11px;color:#777;">FEMA National Risk Index${data.version ? `, ${data.version}` : ""}</p>
        </div>`;
    };

    const heading = hazardName ? `Disaster Risk: ${hazardName}` : "Disaster Risk (all hazards)";
    const info = new L.Control({ position: "topright" });
    info.onAdd = function () {
      const div = L.DomUtil.create("div", "choropleth-info");
      div.innerHTML = `<h4>${heading}</h4>Hover over a county`;
      return div;
    };
    const updateInfo = (label?: string, rating?: string) => {
      const container = (info as unknown as { _container: HTMLElement })._container;
      if (!container) return;
      container.innerHTML = `<h4>${heading}</h4>` + (label != null ? `<b>${label}</b><br/>${rating}` : "Hover over a county");
    };
    info.addTo(map);

    const geoLayer = L.geoJSON(
      { type: "FeatureCollection", features: countyFeatures } as GeoJSON.FeatureCollection,
      {
        style: (feat) => {
          const fips = String(feat?.id ?? "").padStart(5, "0");
          return { ...COUNTY_CHOROPLETH_STYLE, fillColor: RATING_COLORS[ratingLabel(fips)] ?? RATING_COLORS["Insufficient Data"] };
        },
        onEachFeature: (feat, layer) => {
          const fips = String(feat.id ?? "").padStart(5, "0");
          const county = counties[fips];
          const name = county?.name ?? (feat.properties as { name?: string } | null)?.name ?? "";
          const label = county?.state ? `${name}, ${county.state}` : name;

          layer.bindPopup(() => popupHtml(fips, label), { maxWidth: 340 });
          layer.on({
            mouseover: (e: L.LeafletMouseEvent) => {
              const target = e.target as L.Path;
              target.setStyle({ weight: 2, opacity: 1, color: "#444" });
              target.bringToFront();
              updateInfo(label, ratingLabel(fips));
            },
            mouseout: (e: L.LeafletMouseEvent) => {
              geoLayer.resetStyle(e.target as L.Path);
              updateInfo();
            },
          });
        },
      },
    );
    geoLayer.addTo(map);

    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "choropleth-info choropleth-legend");
      div.innerHTML =
        `<h4>${hazardName ? `${hazardName} risk` : "Overall risk"}</h4>` +
        LEGEND_ROWS.map((r) => `<i style="background:${r.color};border:1px solid #ddd;"></i> ${r.label}<br/>`).join("") +
        `<div class="legend-note">FEMA National Risk Index${data.version ? `, ${data.version}` : ""}</div>`;
      return div;
    };
    legend.addTo(map);

    return () => {
      map.removeLayer(geoLayer);
      map.removeControl(info);
      map.removeControl(legend);
    };
  }, [map, countyFeatures, data, selectedHazard]);

  return null;
};

export default NationalRiskIndexLayer;
