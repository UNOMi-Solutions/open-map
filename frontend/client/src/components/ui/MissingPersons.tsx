import { useState, useEffect, useMemo } from "react";

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
    missingPersonQ?: string;
    missingPersonYear?: any;
    timelineRange: TimelineDateRange | null;
    onDateRangeChange: (datasetId: string, range: TimelineDateRange | null) => void;
}

interface MissingPerson {
    id: number;
    caseNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    nicknames: string | null;
    missingAge: string | null;
    sex: string | null;
    raceEthnicity: string | null;
    city: string | null;
    county: string | null;
    state: string | null;
    dateOfLastContact: string;
    modified: string | null;
    circumstances: string | null;
    latitude: number | null;
    longitude: number | null;
    coordinatesApproximate: boolean;
}

interface MissingPersonsResponse {
    success: boolean;
    data: MissingPerson[];
}

const NAMUS_ORIGIN = "https://www.namus.gov";

const icon = CreatePulsingIcon("hsl(100,80%,50%)");

const QUARTER_RANGES: Record<string, [string, string]> = {
    Q1: ["01-01", "03-31"],
    Q2: ["04-01", "06-30"],
    Q3: ["07-01", "09-30"],
    Q4: ["10-01", "12-31"],
};

function toDate(person: MissingPerson): Date {
    return new Date(`${person.dateOfLastContact}T00:00:00Z`);
}

const MissingPersons = ({
    showMissingPersonsData,
    missingPersonQ,
    missingPersonYear,
    timelineRange,
    onDateRangeChange,
} : MissingPersonsProps) => {
    const [missingPersonsData, setMissingPersonsData] = useState<MissingPerson[]>([]);
    const [requested, setRequested] = useState(false);

    useEffect(() => {
        if (showMissingPersonsData) setRequested(true);
    }, [showMissingPersonsData]);

    useEffect(() => {
        if (!requested) return;
        let cancelled = false;
        cachedApiGet<MissingPersonsResponse>(
            "crime:missingPersons:namus",
            "/api/v1/crime/missingPersons",
            CACHE_TTL.CRIME,
        )
            .then((res) => {
                if (!cancelled) setMissingPersonsData(Array.isArray(res?.data) ? res.data : []);
            })
            .catch((error) => {
                console.error("[MissingPersons] Fetch error:", error);
            });
        return () => {
            cancelled = true;
        };
    }, [requested]);

    useEffect(() => {
        onDateRangeChange(
            "missing-persons",
            showMissingPersonsData ? getTimelineDateRange(missingPersonsData.map(toDate)) : null,
        );
        return () => onDateRangeChange("missing-persons", null);
    }, [missingPersonsData, showMissingPersonsData, onDateRangeChange]);

    const visible = useMemo(() => {
        const [startDay, endDay] = QUARTER_RANGES[missingPersonQ ?? "Q1"] ?? QUARTER_RANGES.Q1;
        const startDate = new Date(`${missingPersonYear}-${startDay}T00:00:00Z`);
        const endDate = new Date(`${missingPersonYear}-${endDay}T00:00:00Z`);
        return missingPersonsData.filter((person) => {
            if (person.latitude == null || person.longitude == null) return false;
            const date = toDate(person);
            return date >= startDate && date <= endDate && isDateInTimelineRange(date, timelineRange);
        });
    }, [missingPersonsData, missingPersonQ, missingPersonYear, timelineRange]);

    if (!showMissingPersonsData) return null;

    return (
        <MarkerCompound>
            {visible.map((person) => {
                const name = [person.firstName, person.middleName, person.lastName].filter(Boolean).join(" ");
                const place = [person.city, person.county && `${person.county} County`, person.state].filter(Boolean).join(", ");
                return (
                    <Marker
                        key={person.id}
                        icon={icon}
                        position={[person.latitude as number, person.longitude as number]}
                    >
                        <Popup>
                            <div className="min-w-0 max-w-[300px] max-h-[320px] overflow-y-auto overflow-x-hidden break-words">
                                <img
                                    src={`${NAMUS_ORIGIN}/api/CaseSets/NamUs/MissingPersons/Cases/${person.id}/Images/Default/Thumbnail`}
                                    alt=""
                                    loading="lazy"
                                    className="float-right ml-2 mb-1 max-h-24 max-w-[80px] rounded"
                                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                                />
                                <h3 className="text-base font-bold">{name || "Name withheld"}</h3>
                                {person.nicknames && <p className="text-xs">a.k.a. {person.nicknames}</p>}
                                <p><strong>Case:</strong> {person.caseNumber}</p>
                                <p><strong>Last contact:</strong> {toDate(person).toLocaleDateString(undefined, { timeZone: "UTC" })}</p>
                                {place && <p><strong>Location:</strong> {place}</p>}
                                {person.missingAge && <p><strong>Age when missing:</strong> {person.missingAge}</p>}
                                {(person.sex || person.raceEthnicity) && (
                                    <p>{[person.sex, person.raceEthnicity].filter(Boolean).join(" · ")}</p>
                                )}
                                {person.circumstances && <p className="mt-1 text-xs clear-both">{person.circumstances}</p>}
                                <p className="mt-1">
                                    <a href={`${NAMUS_ORIGIN}/MissingPersons/Case#/${person.id}`} target="_blank" rel="noopener noreferrer">
                                        View NamUs case
                                    </a>
                                </p>
                                {person.coordinatesApproximate && (
                                    <p className="mt-1 text-xs text-gray-500">Location shown at city or county center.</p>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                );
            })}
        </MarkerCompound>
    );
}

export default MissingPersons;
