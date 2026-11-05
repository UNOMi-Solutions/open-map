import { useEffect, useState } from "react";
import {
  Marker,
  Popup
} from "react-leaflet";

import { CreatePulsingIcon } from "./CreateMarker";
import MarkerCompound from "./MarkerCompound";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import {
    getTimelineDateRange,
    isDateInTimelineRange,
    type TimelineDateRange,
} from "@/lib/timeline";

import { OpenStreetMapProvider } from 'leaflet-geosearch';
const provider = new OpenStreetMapProvider();


interface PoliceKillingsProps {
    showPoliceKillingData: boolean;
    timelineRange: TimelineDateRange | null;
    onDateRangeChange: (datasetId: string, range: TimelineDateRange | null) => void;
}

interface Incident {
    locationData: {
        latitude: number;
        longitude: number;
    };
    [key: string]: any;
}

const color = 220;

function getIncidentDate(incident: Incident): Date | null {
    const rawDate = incident["Date of Incident (month/day/year)"];
    if (rawDate == null || rawDate === "") return null;
    const excelDate = Number(rawDate);
    if (!Number.isFinite(excelDate)) return null;
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + excelDate * 86400000);
    return Number.isFinite(date.getTime()) ? date : null;
}

const PoliceKillings = ({
    showPoliceKillingData,
    timelineRange,
    onDateRangeChange,
}: PoliceKillingsProps) => {
    const [PDKillingData, setPDKillingData] = useState<Incident[]>([]);
    const [loadingPDKillingData, setLoadingPDKillingData] = useState<boolean>(true);

    useEffect(() => {
        let cancelled = false;
        cachedApiGet<Incident[]>(
            "lawEnforcement:policeVictimCases",
            "/api/v1/lawEnforcement/policeVictimCases",
            CACHE_TTL.LAW_ENFORCEMENT,
        )
            .then((data) => {
                if (!cancelled) setPDKillingData(Array.isArray(data) ? data : []);
            })
            .catch((error) => {
                console.error("[PoliceKillings] Fetch error:", error);
            })
            .finally(() => {
                if (!cancelled) setLoadingPDKillingData(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        onDateRangeChange(
            "police-killings",
            showPoliceKillingData
                ? getTimelineDateRange(PDKillingData.map(getIncidentDate))
                : null,
        );
        return () => onDateRangeChange("police-killings", null);
    }, [PDKillingData, showPoliceKillingData, onDateRangeChange]);

    if (!showPoliceKillingData) return null;

    return (
        <MarkerCompound>
            {PDKillingData.map((incident: Incident, index: number) => {
                const { locationData } = incident;
                const incidentDate = getIncidentDate(incident);

                if (
                    !incidentDate ||
                    !isDateInTimelineRange(incidentDate, timelineRange) ||
                    locationData == null
                ) {
                    return null;
                }

                return (
                    <Marker
                        icon={CreatePulsingIcon(`hsl(${color},80%,50%)`)}
                        key={index}
                        position={[
                            Number(locationData.latitude),
                            Number(locationData.longitude),
                        ]}
                    >
                        <Popup>
                            <h1>
                                {incidentDate.getMonth() + 1}/{incidentDate.getDate() + 1}/
                                {incidentDate.getFullYear()}
                            </h1>
                            <h1>
                                {incident["Media description of the circumstances surrounding the death"]}
                            </h1>
                            <a
                                href={incident["Link to news article or photo of official document"]}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Read More
                            </a>
                        </Popup>
                    </Marker>
                );
            })}
        </MarkerCompound>
    );
}

export default PoliceKillings;