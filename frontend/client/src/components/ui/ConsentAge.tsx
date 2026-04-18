import { useState, useEffect } from "react";

import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

// All states and their centers
const states = [
  { state: "AL", latitude: 32.806671, longitude: -86.791130, ageOfConsent: 16 },
  { state: "AK", latitude: 61.370716, longitude: -152.404419, ageOfConsent: 16 },
  { state: "AZ", latitude: 34.274882, longitude: -111.660023, ageOfConsent: 18 },
  { state: "AR", latitude: 34.799999, longitude: -92.199997, ageOfConsent: 16 },
  { state: "CA", latitude: 37.271874, longitude: -119.270415, ageOfConsent: 18 },
  { state: "CO", latitude: 38.998394, longitude: -105.547211, ageOfConsent: 17 },
  { state: "CT", latitude: 41.599998, longitude: -72.699997, ageOfConsent: 16 },
  { state: "DE", latitude: 39.000000, longitude: -75.500000, ageOfConsent: 18 },
  { state: "FL", latitude: 27.994402, longitude: -81.760254, ageOfConsent: 18 },
  { state: "GA", latitude: 32.750000, longitude: -83.500000, ageOfConsent: 16 },
  { state: "HI", latitude: 20.900000, longitude: -156.500000, ageOfConsent: 16 },
  { state: "ID", latitude: 44.350000, longitude: -114.633333, ageOfConsent: 18 },
  { state: "IL", latitude: 40.000000, longitude: -89.000000, ageOfConsent: 17 },
  { state: "IN", latitude: 39.766667, longitude: -86.166667, ageOfConsent: 16 },
  { state: "IA", latitude: 42.000000, longitude: -93.500000, ageOfConsent: 16 },
  { state: "KS", latitude: 38.500000, longitude: -98.000000, ageOfConsent: 16 },
  { state: "KY", latitude: 37.500000, longitude: -85.000000, ageOfConsent: 16 },
  { state: "LA", latitude: 31.000000, longitude: -92.000000, ageOfConsent: 17 },
  { state: "ME", latitude: 45.367584, longitude: -68.972168, ageOfConsent: 16 },
  { state: "MD", latitude: 39.000000, longitude: -76.750000, ageOfConsent: 16 },
  { state: "MA", latitude: 42.250000, longitude: -71.500000, ageOfConsent: 16 },
  { state: "MI", latitude: 44.182205, longitude: -84.506836, ageOfConsent: 16 },
  { state: "MN", latitude: 46.280000, longitude: -94.305305, ageOfConsent: 16 },
  { state: "MS", latitude: 32.767799, longitude: -89.681541, ageOfConsent: 16 },
  { state: "MO", latitude: 38.573936, longitude: -92.603760, ageOfConsent: 17 },
  { state: "MT", latitude: 46.965260, longitude: -110.536380, ageOfConsent: 16 },
  { state: "NE", latitude: 41.500000, longitude: -99.750000, ageOfConsent: 17 },
  { state: "NV", latitude: 39.876019, longitude: -117.224121, ageOfConsent: 16 },
  { state: "NH", latitude: 44.000000, longitude: -71.500000, ageOfConsent: 16 },
  { state: "NJ", latitude: 40.150000, longitude: -74.666667, ageOfConsent: 16 },
  { state: "NM", latitude: 34.500000, longitude: -106.000000, ageOfConsent: 17 },
  { state: "NY", latitude: 43.000000, longitude: -75.000000, ageOfConsent: 17 },
  { state: "NC", latitude: 35.500000, longitude: -79.500000, ageOfConsent: 16 },
  { state: "ND", latitude: 47.450000, longitude: -100.450000, ageOfConsent: 18 },
  { state: "OH", latitude: 40.367474, longitude: -82.996216, ageOfConsent: 16 },
  { state: "OK", latitude: 35.500000, longitude: -97.500000, ageOfConsent: 16 },
  { state: "OR", latitude: 44.000000, longitude: -120.500000, ageOfConsent: 18 },
  { state: "PA", latitude: 41.203323, longitude: -77.194527, ageOfConsent: 16 },
  { state: "RI", latitude: 41.700001, longitude: -71.500000, ageOfConsent: 16 },
  { state: "SC", latitude: 33.750000, longitude: -80.500000, ageOfConsent: 16 },
  { state: "SD", latitude: 44.500000, longitude: -100.350000, ageOfConsent: 16 },
  { state: "TN", latitude: 35.860119, longitude: -86.660156, ageOfConsent: 18 },
  { state: "TX", latitude: 31.000000, longitude: -100.000000, ageOfConsent: 17 },
  { state: "UT", latitude: 39.419220, longitude: -111.950684, ageOfConsent: 18 },
  { state: "VT", latitude: 44.000000, longitude: -72.699997, ageOfConsent: 16 },
  { state: "VA", latitude: 37.500000, longitude: -78.500000, ageOfConsent: 18 },
  { state: "WA", latitude: 47.400902, longitude: -120.500000, ageOfConsent: 16 },
  { state: "WV", latitude: 38.500000, longitude: -80.500000, ageOfConsent: 16 },
  { state: "WI", latitude: 44.500000, longitude: -89.500000, ageOfConsent: 18 },
  { state: "WY", latitude: 43.000000, longitude: -107.500000, ageOfConsent: 18 }
];

const ConsentAge = ({ showConsentAgeData } : { showConsentAgeData: boolean }) => {
    if (!showConsentAgeData) return null;
    return <>
        {
            states.map(({state, latitude, longitude, ageOfConsent}) => {
                const consentIcon = L.divIcon({
                    className: "custom-div-icon",
                    html: `<div style='background-color:#2A9D8F; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: bold;'>${ageOfConsent}</div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });

                return <Marker position={[ latitude, longitude ]} icon={consentIcon} key={state}></Marker>
            })
        }
    </>
}

export default ConsentAge;