import { useEffect, useState } from "react";
import {
  Marker,
  Popup
} from "react-leaflet";

import DonutChart from "./DonutChart";

import { CreateMarker } from "./CreateMarker";

// All states and their centers
const states = [
  { state: "AL", latitude: 32.806671, longitude: -86.791130 },
  { state: "AK", latitude: 61.370716, longitude: -152.404419 },
  { state: "AZ", latitude: 34.274882, longitude: -111.660023 },
  { state: "AR", latitude: 34.799999, longitude: -92.199997 },
  { state: "CA", latitude: 37.271874, longitude: -119.270415 },
  { state: "CO", latitude: 38.998394, longitude: -105.547211 },
  { state: "CT", latitude: 41.599998, longitude: -72.699997 },
  { state: "DE", latitude: 39.000000, longitude: -75.500000 },
  { state: "FL", latitude: 27.994402, longitude: -81.760254 },
  { state: "GA", latitude: 32.750000, longitude: -83.500000 },
  { state: "HI", latitude: 20.900000, longitude: -156.500000 },
  { state: "ID", latitude: 44.350000, longitude: -114.633333 },
  { state: "IL", latitude: 40.000000, longitude: -89.000000 },
  { state: "IN", latitude: 39.766667, longitude: -86.166667 },
  { state: "IA", latitude: 42.000000, longitude: -93.500000 },
  { state: "KS", latitude: 38.500000, longitude: -98.000000 },
  { state: "KY", latitude: 37.500000, longitude: -85.000000 },
  { state: "LA", latitude: 31.000000, longitude: -92.000000 },
  { state: "ME", latitude: 45.367584, longitude: -68.972168 },
  { state: "MD", latitude: 39.000000, longitude: -76.750000 },
  { state: "MA", latitude: 42.250000, longitude: -71.500000 },
  { state: "MI", latitude: 44.182205, longitude: -84.506836 },
  { state: "MN", latitude: 46.280000, longitude: -94.305305 },
  { state: "MS", latitude: 32.767799, longitude: -89.681541 },
  { state: "MO", latitude: 38.573936, longitude: -92.603760 },
  { state: "MT", latitude: 46.965260, longitude: -110.536380 },
  { state: "NE", latitude: 41.500000, longitude: -99.750000 },
  { state: "NV", latitude: 39.876019, longitude: -117.224121 },
  { state: "NH", latitude: 44.000000, longitude: -71.500000 },
  { state: "NJ", latitude: 40.150000, longitude: -74.666667 },
  { state: "NM", latitude: 34.500000, longitude: -106.000000 },
  { state: "NY", latitude: 43.000000, longitude: -75.000000 },
  { state: "NC", latitude: 35.500000, longitude: -79.500000 },
  { state: "ND", latitude: 47.450000, longitude: -100.450000 },
  { state: "OH", latitude: 40.367474, longitude: -82.996216 },
  { state: "OK", latitude: 35.500000, longitude: -97.500000 },
  { state: "OR", latitude: 44.000000, longitude: -120.500000 },
  { state: "PA", latitude: 41.203323, longitude: -77.194527 },
  { state: "RI", latitude: 41.700001, longitude: -71.500000 },
  { state: "SC", latitude: 33.750000, longitude: -80.500000 },
  { state: "SD", latitude: 44.500000, longitude: -100.350000 },
  { state: "TN", latitude: 35.860119, longitude: -86.660156 },
  { state: "TX", latitude: 31.000000, longitude: -100.000000 },
  { state: "UT", latitude: 39.419220, longitude: -111.950684 },
  { state: "VT", latitude: 44.000000, longitude: -72.699997 },
  { state: "VA", latitude: 37.500000, longitude: -78.500000 },
  { state: "WA", latitude: 47.400902, longitude: -120.500000 },
  { state: "WV", latitude: 38.500000, longitude: -80.500000 },
  { state: "WI", latitude: 44.500000, longitude: -89.500000 },
  { state: "WY", latitude: 43.000000, longitude: -107.500000 }
];

const color = 20;

interface ArrestMarkersProps {
    arrestCategory: string;
    showArrestData: boolean;
}

const HomicideMarkers = ({ arrestCategory, showArrestData } : ArrestMarkersProps) => {
    const [murderData, setMurderData] = useState<any>({});
    const [loadingMurderData, setLoadingMurderData] = useState<Boolean>(true);

    const [currentCategory, setCurrentCategory] = useState<string>("Arrestee Race");

    useEffect(() => {
        let raw = localStorage.getItem("OpenMap-Arrest-Data") || "null";
        let browserData = JSON.parse(raw);
        let currentTimestamp = new Date();

        if(browserData == null || (+currentTimestamp - +browserData.timestamp > 86400000)) {
            //https://openmap-backend.onrender.com/api/v1/crime/murderByState
            //"http://localhost:8000/api/v1/crime/murderByState"
            fetch("https://openmap-backend.onrender.com/api/v1/crime/arrestsByState", {
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
                //console.log("API Repsonse:", data)
                data.timestamp = new Date();
                setMurderData(data);
                localStorage.setItem("OpenMap-Arrest-Data", JSON.stringify(data));
                setLoadingMurderData(false);
            })
            .catch(error => {
                console.error("Fetch error:", error);
            });
        } else {
            //console.log("Browser Repsonse:", browserData)
            setMurderData(browserData);
            setLoadingMurderData(false);
        }

    }, []);

    return <>
    
        {/* TESTING - Adding pins for general state data */}
        {
          showArrestData &&
          states.map(({state, latitude, longitude}) => {
            //if((state != "AK") && (state != "HI")) {
              return <Marker position={[ latitude, longitude ]} icon={CreateMarker(`hsl(${color},80%,50%)`)} key={state}>
                {
                  (!loadingMurderData) ?
                    <Popup>
                        <h1 style={{
                            fontSize: "1.5rem",
                            fontWeight: "bolder"
                        }}>Arrests in {state} (2026)</h1>

                        <DonutChart
                            key={state}
                            data={murderData?.[state]?.[arrestCategory] ?? {}}
                            color={color}
                        />
                    </Popup>
                    : <Popup>Loading...</Popup>
                }
              </Marker>
            //}
          })
        }

    </>
};

export default HomicideMarkers;