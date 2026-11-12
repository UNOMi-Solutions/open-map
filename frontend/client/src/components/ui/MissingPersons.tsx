import { useState, useEffect } from "react";

import { Marker, Popup } from "react-leaflet";

import { CreatePulsingIcon } from "./CreateMarker";
import MarkerCompound from "./MarkerCompound";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";
import {
    getTimelineDateRange,
    isDateInTimelineRange,
    type TimelineDateRange,
} from "@/lib/timeline";

interface MissingPersonsProps {
    showMissingPersonsData: boolean;
    timelineRange: TimelineDateRange | null;
    onDateRangeChange: (datasetId: string, range: TimelineDateRange | null) => void;
}

const color = 100;

interface MissingPerson {
    locationData: {
        latitude: number;
        longitude: number;
    };
    [key: string]: any;
}

function getMissingPersonDate(person: Record<string, unknown>): Date | null {
    const dateValue = Object.entries(person).find(
        ([key]) => key.replace(/^\uFEFF/, "").replace(/^"(.*)"$/, "$1") === "DLC",
    )?.[1];
    if (typeof dateValue !== "string" && typeof dateValue !== "number") return null;
    const date = new Date(dateValue);
    return Number.isFinite(date.getTime()) ? date : null;
}

const MissingPersons = ({
    showMissingPersonsData,
    timelineRange,
    onDateRangeChange,
} : MissingPersonsProps) => {
    const [missingPersonsData, setMissingPersonsData] = useState<MissingPerson[]>([]);
    const [loadingMissingPersonsData, setLoadingMissingPersonsData] = useState<boolean>(true);

    useEffect(() => {
        let cancelled = false;
        cachedApiGet<MissingPerson[]>(
            "crime:missingPersons",
            "/api/v1/crime/missingPersons",
            CACHE_TTL.CRIME,
        )
            .then((data) => {
                if (!cancelled) setMissingPersonsData(Array.isArray(data) ? data : []);
            })
            .catch((error) => {
                console.error("[MissingPersons] Fetch error:", error);
            })
            .finally(() => {
                if (!cancelled) setLoadingMissingPersonsData(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        onDateRangeChange(
            "missing-persons",
            showMissingPersonsData
                ? getTimelineDateRange(
                    missingPersonsData.map(getMissingPersonDate),
                )
                : null,
        );
        return () => onDateRangeChange("missing-persons", null);
    }, [missingPersonsData, showMissingPersonsData, onDateRangeChange]);

    if (!showMissingPersonsData || loadingMissingPersonsData) return null;

    return (
        <MarkerCompound>
            {missingPersonsData.map((missingPerson: MissingPerson, index: number) => {
                const cleanedObj = Object.fromEntries(
                    Object.entries(missingPerson).map(([key, value]) => [
                        key.replace(/^\uFEFF/, '').replace(/^"(.*)"$/, '$1'),
                        value
                    ])
                );
                const { locationData, "Case Number": caseNumber, "Legal First Name": legalFirstName, "Legal Last Name": legalLastName } = cleanedObj;
                const missingPersonDate = getMissingPersonDate(cleanedObj);

                if (
                    !missingPersonDate ||
                    !isDateInTimelineRange(missingPersonDate, timelineRange) ||
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
                            <h1>Case Number: {caseNumber}</h1>
                            <h1>{legalFirstName} {legalLastName}</h1>
                            <h2>Went missing in {cleanedObj["City"]}, {cleanedObj["State"]}</h2>
                            <h2>Date of Last Contact: {missingPersonDate.toLocaleDateString()}</h2>
                        </Popup>
                    </Marker>
                );
            })}
        </MarkerCompound>
    );
}

export default MissingPersons;