import { useState, useEffect, useMemo } from "react";

import L from "leaflet";
import "leaflet.markercluster";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import { useMap } from "react-leaflet";

import { CreatePulsingIcon } from "./CreateMarker";
import { POINT_CLUSTER_RADIUS } from "./MarkerCompound";
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

function toDate(person: MissingPerson): Date {
    return new Date(`${person.dateOfLastContact}T00:00:00Z`);
}

function esc(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function popupHtml(person: MissingPerson): string {
    const name = [person.firstName, person.middleName, person.lastName].filter(Boolean).join(" ");
    const place = [person.city, person.county && `${person.county} County`, person.state].filter(Boolean).join(", ");
    const traits = [person.sex, person.raceEthnicity].filter(Boolean).join(" · ");
    const rows: Array<[string, string | null]> = [
        ["Case", person.caseNumber],
        ["Last contact", toDate(person).toLocaleDateString(undefined, { timeZone: "UTC" })],
        ["Location", place || null],
        ["Age when missing", person.missingAge],
    ];
    return `
        <div style="min-width:200px;max-width:300px;max-height:320px;overflow-y:auto;overflow-x:hidden;overflow-wrap:break-word;">
            <img src="${NAMUS_ORIGIN}/api/CaseSets/NamUs/MissingPersons/Cases/${person.id}/Images/Default/Thumbnail"
                alt="" loading="lazy" onerror="this.style.display='none'"
                style="float:right;margin:0 0 4px 8px;max-height:96px;max-width:80px;border-radius:4px;" />
            <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;">${esc(name || "Name withheld")}</h3>
            ${person.nicknames ? `<p style="margin:0 0 4px;font-size:12px;">a.k.a. ${esc(person.nicknames)}</p>` : ""}
            ${rows
                .filter((row): row is [string, string] => Boolean(row[1]))
                .map(([label, value]) => `<p style="margin:2px 0 0;"><strong>${label}:</strong> ${esc(value)}</p>`)
                .join("")}
            ${traits ? `<p style="margin:2px 0 0;">${esc(traits)}</p>` : ""}
            ${person.circumstances ? `<p style="clear:both;margin:6px 0 0;font-size:12px;">${esc(person.circumstances)}</p>` : ""}
            <p style="margin:6px 0 0;"><a href="${NAMUS_ORIGIN}/MissingPersons/Case#/${person.id}" target="_blank" rel="noopener noreferrer">View NamUs case</a></p>
            ${person.coordinatesApproximate ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Location shown at city or county center.</p>` : ""}
        </div>`;
}

const MissingPersons = ({
    showMissingPersonsData,
    timelineRange,
    onDateRangeChange,
} : MissingPersonsProps) => {
    const map = useMap();
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

    // Tens of thousands of cases: plain Leaflet markers bulk-added to the cluster group,
    // since one React <Marker> per case locks up the page for half a minute.
    const markers = useMemo(
        () =>
            missingPersonsData
                .filter((person) => person.latitude != null && person.longitude != null)
                .map((person) => ({
                    date: toDate(person),
                    marker: L.marker([person.latitude as number, person.longitude as number], { icon })
                        .bindPopup(() => popupHtml(person), { maxWidth: 320 }),
                })),
        [missingPersonsData],
    );

    const group = useMemo(
        () => L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: POINT_CLUSTER_RADIUS }),
        [],
    );

    useEffect(() => {
        if (!showMissingPersonsData) return;
        group.addTo(map);
        return () => {
            map.removeLayer(group);
        };
    }, [map, group, showMissingPersonsData]);

    useEffect(() => {
        group.clearLayers();
        group.addLayers(
            markers
                .filter(({ date }) => isDateInTimelineRange(date, timelineRange))
                .map(({ marker }) => marker),
        );
    }, [group, markers, timelineRange]);

    return null;
}

export default MissingPersons;
