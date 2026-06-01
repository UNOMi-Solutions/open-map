import { useEffect, useState } from "react";
import {
  Marker,
  Popup
} from "react-leaflet";

import { CreateMarker } from "./CreateMarker";

import { OpenStreetMapProvider } from 'leaflet-geosearch';
const provider = new OpenStreetMapProvider();


export type PoliceKillingQKey = 
    | "Q1"
    | "Q2"
    | "Q3"
    | "Q4";

interface PoliceKillingsProps {
    PoliceKillingQ: PoliceKillingQKey;
    PoliceKillingYear: number;
    showPoliceKillingData: boolean;
}

const color = 220;

const PoliceKillings = ({ PoliceKillingQ, PoliceKillingYear, showPoliceKillingData }: PoliceKillingsProps) => {
    interface Incident {
        locationData: {
            latitude: number;
            longitude: number;
        };
        [key: string]: any;
    }
    const [PDKillingData, setPDKillingData] = useState<Incident[]>([]);
    const [loadingPDKillingData, setLoadingPDKillingData] = useState<boolean>(true);

    let raw = localStorage.getItem("OpenMap-Police-Killing-Data") || "null";
    let browserData = JSON.parse(raw);

    const [startDate, setStartDate] = useState<Date>(new Date("2026-01-01"));
    const [endDate, setEndDate] = useState<Date>(new Date("2026-03-31"));

    useEffect(() => {
        switch(PoliceKillingQ) {
            case "Q1":
                setStartDate(new Date(`${PoliceKillingYear}-01-01`));
                setEndDate(new Date(`${PoliceKillingYear}-03-31`));
                break;
            case "Q2":
                setStartDate(new Date(`${PoliceKillingYear}-04-01`));
                setEndDate(new Date(`${PoliceKillingYear}-06-30`));
                break;
            case "Q3":
                setStartDate(new Date(`${PoliceKillingYear}-07-01`));
                setEndDate(new Date(`${PoliceKillingYear}-09-30`));
                break;
            case "Q4":
                setStartDate(new Date(`${PoliceKillingYear}-10-01`));
                setEndDate(new Date(`${PoliceKillingYear}-12-31`));
                break;
            default:
                setStartDate(new Date(`${PoliceKillingYear}-01-01`));
                setEndDate(new Date(`${PoliceKillingYear}-03-31`));
        }
    }, [PoliceKillingQ, PoliceKillingYear]);

    useEffect(() => {
        if(browserData == null) {
            // https://openmap-backend.onrender.com
            // http://localhost:8000
            fetch("http://localhost:8000/api/v1/lawEnforcement/policeVictimCases", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    //"x-api-key": import.meta.env.VITE_API_DEV_KEY || ""
                    "x-api-key": "ZWFnbGVzIGNhbiBmbHk"                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                //console.log("API Repsonse:", data);
                setPDKillingData(data);
                //localStorage.setItem("OpenMap-Police-Killing-Data", JSON.stringify(data));
                setLoadingPDKillingData(false);
            })
            .catch(error => {
                console.error("Fetch error:", error);
            });
        } else {
            console.log("API Repsonse:", browserData);
            setPDKillingData(browserData);
            //localStorage.setItem("OpenMap-Police-Killing-Data", JSON.stringify(browserData));
            setLoadingPDKillingData(false);
        }

    }, []);

    return (!showPoliceKillingData) ? null : <>
    
        {
            PDKillingData.map((incident: Incident, index: number) => {
                const { locationData } = incident;
                const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                const incidentDate = new Date(excelEpoch.getTime() + incident['Date of Incident (month/day/year)'] * 86400000);
                
                if(incidentDate > startDate && incidentDate < endDate) {
                    return (
                        (locationData != null) ? <Marker icon={CreateMarker(`hsl(${color},80%,50%)`)} key={index} position={[Number(locationData["latitude"]), Number(locationData["longitude"])]}>
                            <Popup>
                                <h1>{ incidentDate.getMonth() + 1 }/{ incidentDate.getDate() + 1 }/{ incidentDate.getFullYear() } </h1>
                                <h1>{ incident["Media description of the circumstances surrounding the death"] }</h1>
                                <a href={ incident['Link to news article or photo of official document'] } target="_blank" rel="noopener noreferrer">Read More</a>`
                            </Popup>
                        </Marker> : null
                    );
                }
                else {
                    return null;
                }
            })
        }
    
    </>
}

export default PoliceKillings;