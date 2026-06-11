import { useEffect, useState } from "react";
import {
  Marker,
  Popup
} from "react-leaflet";

import { CreateMarker } from "./CreateMarker";
import { cachedApiGet, CACHE_TTL } from "@/lib/apiCache";

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