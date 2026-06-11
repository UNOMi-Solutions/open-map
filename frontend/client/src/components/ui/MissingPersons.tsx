import { useState, useEffect } from "react";

import { Marker, Popup } from "react-leaflet";

import { CreateMarker } from "./CreateMarker";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";

interface MissingPersonsProps {
    showMissingPersonsData: boolean;
    missingPersonQ?: string;
    missingPersonYear?: any;
}

const color = 100;

interface MissingPerson {
    locationData: {
        latitude: number;
        longitude: number;
    };
    [key: string]: any;
}

const MissingPersons = ({ showMissingPersonsData, missingPersonQ, missingPersonYear } : MissingPersonsProps) => {
    const [missingPersonsData, setMissingPersonsData] = useState<MissingPerson[]>([]);
    const [loadingMissingPersonsData, setLoadingMissingPersonsData] = useState<Boolean>(true);

    const [startDate, setStartDate] = useState<Date>(new Date("2026-01-01"));
    const [endDate, setEndDate] = useState<Date>(new Date("2026-03-31"));

    useEffect(() => {
        switch(missingPersonQ) {
            case "Q1":
                setStartDate(new Date(`${missingPersonYear}-01-01`));
                setEndDate(new Date(`${missingPersonYear}-03-31`));
                break;
            case "Q2":
                setStartDate(new Date(`${missingPersonYear}-04-01`));
                setEndDate(new Date(`${missingPersonYear}-06-30`));
                break;
            case "Q3":
                setStartDate(new Date(`${missingPersonYear}-07-01`));
                setEndDate(new Date(`${missingPersonYear}-09-30`));
                break;
            case "Q4":
                setStartDate(new Date(`${missingPersonYear}-10-01`));
                setEndDate(new Date(`${missingPersonYear}-12-31`));
                break;
            default:
                setStartDate(new Date(`${missingPersonYear}-01-01`));
                setEndDate(new Date(`${missingPersonYear}-03-31`));
        }
    }, [missingPersonQ, missingPersonYear]);

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

    return <>
        {
            showMissingPersonsData &&
            !loadingMissingPersonsData && 
            missingPersonsData.map((missingPerson: MissingPerson, index: number) => {
                const cleanedObj = Object.fromEntries(
                    Object.entries(missingPerson).map(([key, value]) => [
                        key.replace(/^\uFEFF/, '').replace(/^"(.*)"$/, '$1'),
                        value
                    ])
                );
                const { locationData, DLC, "Case Number": caseNumber, "Legal First Name": legalFirstName, "Legal Last Name": legalLastName } = cleanedObj;
                const missingPersonDate = new Date(DLC);

                return (locationData != null && missingPersonDate >= startDate && missingPersonDate <= endDate) ? <Marker icon={CreateMarker(`hsl(${color},80%,50%)`)} position={[Number(locationData["latitude"]), Number(locationData["longitude"])]} key={index}>
                    <Popup>
                        <h1>Case Number: { caseNumber }</h1>
                        <h1>{ legalFirstName } { legalLastName }</h1>
                        <h2>Went missing in { cleanedObj['City'] }, { cleanedObj['State'] }</h2>
                        <h2>Date of Last Contact: { missingPersonDate.toLocaleDateString() }</h2>
                    </Popup>
                </Marker> : null;
            })
        }
    </>
}

export default MissingPersons;