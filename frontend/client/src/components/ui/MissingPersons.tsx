import { useState, useEffect } from "react";

import { Marker, Popup } from "react-leaflet";

import { CreateMarker } from "./CreateMarker";

interface MissingPersonsProps {
    showMissingPersonsData: boolean;
    missingPersonQ?: string;
    missingPersonYear?: any;
}

const color = 100;

const MissingPersons = ({ showMissingPersonsData, missingPersonQ, missingPersonYear } : MissingPersonsProps) => {
    const [missingPersonsData, setMissingPersonsData] = useState<any>({});
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

    interface MissingPerson {
        locationData: {
            latitude: number;
            longitude: number;
        };
        [key: string]: any;
    }

    useEffect(() => {
        let raw = localStorage.getItem("OpenMap-Missing-Persons-Data") || "null";
        let browserData = JSON.parse(raw);
        let currentTimestamp = new Date();

        if(browserData == null || (+currentTimestamp - +browserData.timestamp > 86400000)) {
            //https://openmap-backend.onrender.com/api/v1/missing-persons
            //"http://localhost:8000/api/v1/missing-persons"
            fetch("http://localhost:8000/api/v1/crime/missingPersons", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    //"x-api-key": import.meta.env.VITE_API_DEV_KEY || ""
                    "x-api-key": "ZWFnbGVzIGNhbiBmbHk"
                }
            })
            .then(response => {
                if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                //console.log("API Repsonse:", data)
                data.timestamp = new Date();
                setMissingPersonsData(data);
                //localStorage.setItem("OpenMap-Missing-Persons-Data", JSON.stringify(data));
                setLoadingMissingPersonsData(false);
            })
            .catch(error => {
                console.error("Fetch error:", error);
            });
        } else {
            console.log("Browser Repsonse:", browserData)
            setMissingPersonsData(browserData);
            setLoadingMissingPersonsData(false);
        }

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