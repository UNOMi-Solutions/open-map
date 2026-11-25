import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import MarkerCompound from "./MarkerCompound";
import { useEffect, useState } from "react";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";

type Dam = {
  id: string;
  name: string | null;
  latitude: number;
  longitude: number;
  state: string | null;
  city: string | null;
  river: string | null;
  primaryPurpose: string | null;
  damHeight: number | null;
  yearCompleted: number | null;
  hazardPotential: string | null;
  conditionAssessment: string | null;
  operationalStatus: string | null;
};

type DamResponse = {
  description: string;
  hazard: string;
  count: number;
  data: Dam[];
};

type DamMarkersProps = {
  selectedHazard: string;
  selectedYear?: string;
  setLoading?: (loading: boolean) => void;
};

const hazardStyle = (hazard: string) => {
  switch (hazard) {
    case "High":
      return {
        color: "#dc2626",
        fillColor: "#dc2626",
        radius: 7,
      };

    case "Significant":
      return {
        color: "#f97316",
        fillColor: "#f97316",
        radius: 6,
      };

    case "Low":
      return {
        color: "#eab308",
        fillColor: "#eab308",
        radius: 5,
      };

    default:
      return {
        color: "#64748b",
        fillColor: "#64748b",
        radius: 5,
      };
  }
};

const createDamIcon = (hazard: string) => {
  let color = "#eab308";

  if (hazard === "High") {
    color = "#dc2626";
  } else if (hazard === "Significant") {
    color = "#f97316";
  }

  return L.divIcon({
    className: "",
    html: `
      <div
        style="
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        "
      ></div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

const createDamClusterIcon = (cluster: any) => {
  const markers = cluster.getAllChildMarkers();

  let high = 0;
  let significant = 0;
  let low = 0;

  markers.forEach((marker: any) => {
    const hazard = marker.options?.damHazard;

    if (hazard === "High") {
      high++;
    } else if (hazard === "Significant") {
      significant++;
    } else if (hazard === "Low") {
      low++;
    }
  });

  const total = high + significant + low;

  if (total === 0) {
    return L.divIcon({
      className: "",
      html: `<div>${cluster.getChildCount()}</div>`,
      iconSize: [44, 44],
    });
  }

  const highPercent = (high / total) * 100;
  const significantPercent = (significant / total) * 100;

  const highEnd = highPercent;
  const significantEnd = highPercent + significantPercent;

  return L.divIcon({
    className: "",
    html: `
      <div
        style="
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: conic-gradient(
            #dc2626 0% ${highEnd}%,
            #f97316 ${highEnd}% ${significantEnd}%,
            #eab308 ${significantEnd}% 100%
          );
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
        "
      >
        <div
          style="
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            color: black;
          "
        >
          ${total}
        </div>
      </div>
    `,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
  });
};

export default function DamMarkers({
  selectedHazard,
  selectedYear = "all",
  setLoading,
}: DamMarkersProps) {
  const [dams, setDams] = useState<Dam[]>([]);

  useEffect(() => {
    let mounted = true;

    const fetchDams = async () => {
      try {
        setLoading?.(true);

        setDams([]);

        const hazard = selectedHazard || "all";

        const response = await cachedApiGet<DamResponse>(
          `environment:dams-v3:${hazard}:${selectedYear}`,
          `/api/v1/environment/dams?hazard=${encodeURIComponent(
            hazard
          )}&year=${encodeURIComponent(selectedYear)}`,
          CACHE_TTL.ENVIRONMENT_GLOBAL
        );


        if (mounted) {
          setDams(response.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch dam data:", error);

        if (mounted) {
          setDams([]);
        }
      } finally {
        if (mounted) {
          setLoading?.(false);
        }
      }
    };

    fetchDams();

    return () => {
      mounted = false;
    };
  }, [selectedHazard, selectedYear, setLoading]);


  return (
    <MarkerCompound
      key={`dams-${selectedHazard}-${selectedYear}`}
      iconCreateFunction={createDamClusterIcon}
      showCoverageOnHover={false}
      maxClusterRadius={26}
    >
      {dams.map((dam) => (
        <Marker
          key={`${selectedHazard}-${selectedYear}-${dam.id}-${dam.latitude}-${dam.longitude}`}
          position={[dam.latitude, dam.longitude]}
          icon={createDamIcon(dam.hazardPotential || "")}
          {...({
            damHazard: dam.hazardPotential,
          } as any)}
        >
          <Popup>
            <div style={{ minWidth: "220px" }}>
              <strong style={{ fontSize: "1rem" }}>
                {dam.name || "Unnamed Dam"}
              </strong>

              <p>
                <strong>Hazard Potential:</strong>{" "}
                {dam.hazardPotential || "Unknown"}
              </p>

              {dam.state && (
                <p>
                  <strong>State:</strong> {dam.state}
                </p>
              )}

              {dam.city && (
                <p>
                  <strong>City:</strong> {dam.city}
                </p>
              )}

              {dam.river && (
                <p>
                  <strong>River/Stream:</strong> {dam.river}
                </p>
              )}

              {dam.yearCompleted && (
                <p>
                  <strong>Year Completed:</strong> {dam.yearCompleted}
                </p>
              )}

              {dam.damHeight != null && (
                <p>
                  <strong>Dam Height:</strong> {dam.damHeight} ft
                </p>
              )}

              {dam.primaryPurpose && (
                <p>
                  <strong>Primary Purpose:</strong> {dam.primaryPurpose}
                </p>
              )}

              {dam.conditionAssessment && (
                <p>
                  <strong>Condition:</strong> {dam.conditionAssessment}
                </p>
              )}

              {dam.operationalStatus && (
                <p>
                  <strong>Operational Status:</strong>{" "}
                  {dam.operationalStatus}
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MarkerCompound>
  );
}