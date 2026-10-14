// import env file, and axios (automatic json)
import dotenv from "dotenv";
dotenv.config();

import axios from "axios"
import JSZip from "jszip"
import XLSX from "xlsx"
import Papa from "papaparse"

import { response, Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// Cache for GHG emissions data
let ghgEmissionsCache = null;

// Cache for oil spills data
let oilSpillsCache = null;

const DISASTER_START_DATE = '2024-01-01'; // Only fetch disasters since 2024

// Test Command
router.get('/test', (req, res) => {
    const testResponse = { "response": "Success: Viewing Environment Data" };
    res.json(testResponse);
})

// US state centroids (approx) - for stateCode lookup when lat/long not provided
const US_STATE_CENTROIDS = {
    AL: [32.3182, -86.9023], AK: [64.8378, -153.4937], AZ: [34.0489, -111.0937], AR: [35.2010, -91.8318],
    CA: [36.7783, -119.4179], CO: [39.1130, -105.3110], CT: [41.6032, -73.0877], DE: [38.9108, -75.5277],
    FL: [27.6648, -81.5158], GA: [32.1574, -82.9071], HI: [19.8968, -155.5828], ID: [44.0682, -114.7420],
    IL: [40.6331, -89.3985], IN: [40.2672, -86.1349], IA: [41.8780, -93.0977], KS: [38.5266, -96.7265],
    KY: [37.6681, -84.6701], LA: [31.1695, -91.8678], ME: [45.2538, -69.4455], MD: [39.0458, -76.6413],
    MA: [42.4072, -71.3824], MI: [43.3266, -84.5361], MN: [46.7296, -94.6859], MS: [32.3547, -89.3985],
    MO: [37.9643, -91.8318], MT: [46.8797, -110.3626], NE: [41.4925, -99.9018], NV: [38.8026, -116.4194],
    NH: [43.1939, -71.5724], NJ: [40.0583, -74.4057], NM: [34.5199, -105.8701], NY: [43.2994, -74.2179],
    NC: [35.7596, -79.0193], ND: [47.5515, -101.0020], OH: [40.4173, -82.9071], OK: [35.0078, -97.0929],
    OR: [43.8041, -120.5542], PA: [41.2033, -77.1945], RI: [41.5801, -71.4774], SC: [33.8361, -81.1637],
    SD: [43.9695, -99.9018], TN: [35.5175, -86.5804], TX: [31.9686, -99.9018], UT: [39.3210, -111.0937],
    VT: [44.5588, -72.5778], VA: [37.4316, -78.6569], WA: [47.7511, -120.7401], WV: [38.5976, -80.4549],
    WI: [43.7844, -88.7879], WY: [43.0760, -107.2903]
};

// Params: lat & long OR stateCode
router.get('/airQuality', async (req, res) => {
    const { lat, long, stateCode } = req.query;

    let latitude, longitude;

    if (lat != null && long != null) {
        latitude = parseFloat(lat);
        longitude = parseFloat(long);
        if (isNaN(latitude) || isNaN(longitude)) {
            return res.status(400).json({ error: "Latitude and longitude must be numbers" });
        }
    } else if (stateCode) {
        const code = stateCode.toString().trim().toUpperCase();
        const centroid = US_STATE_CENTROIDS[code];
        if (!centroid) {
            return res.status(400).json({ error: `Unknown state code: ${stateCode}. Use a 2-letter US state code (e.g. WY, CA).` });
        }
        [latitude, longitude] = centroid;
    } else {
        return res.status(400).json({ error: "Provide either lat & long or stateCode (e.g. ?lat=41&long=-105 or ?stateCode=WY)" });
    }

    const token = process.env.AQICN_API_TOKEN;
    if (!token) {
        return res.status(500).json({ error: "AQICN_API_TOKEN is not configured. Add it to your .env file." });
    }

    try {
        const response = await axios.get(`https://api.waqi.info/feed/geo:${latitude};${longitude}/`, {
            params: { token }
        });
        res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch air quality data" });
    }
});


// Retrieve green house gas emissions from factories/mines in different industry sectors 
router.get("/ghgEmissions", async (req, res) => {
    try {
      const stateCode = (req.query.stateCode || "").toString().trim().toUpperCase();
      const facilityNameQuery = (req.query.facilityName || "").toString().trim().toLowerCase();
  
      if (!stateCode) {
        return res.status(400).json({ error: "Please provide state code" });
      }
  
      // Download + cache if needed
      if (!ghgEmissionsCache) {
        console.log("Downloading and processing GHG emissions data...");
  
        const response = await axios.get(
          "https://www.epa.gov/system/files/other-files/2024-10/2023_data_summary_spreadsheets.zip",
          { responseType: "arraybuffer" }
        );
  
        const unZip = await JSZip.loadAsync(response.data);
        const fileName = Object.keys(unZip.files).find(
          (name) =>
            name.toLowerCase().includes("ghgp_data_2023") && name.endsWith(".xlsx")
        );
  
        if (!fileName) {
          return res.status(404).json({ error: "File not found" });
        }
  
        const bytes = await unZip.files[fileName].async("arraybuffer");
        const workbook = XLSX.read(bytes, { type: "arraybuffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
        });
  
        const headerRowIndex = 3;
        const headers = rows[headerRowIndex];
        const dataRows = rows.slice(headerRowIndex + 1);
  
        const jsonData = dataRows.map((row) => {
          const obj = {};
          headers.forEach((h, i) => {
            obj[h] = row[i];
          });
          return obj;
        });
  
        ghgEmissionsCache = jsonData;
        console.log("GHG emissions data cached successfully");
      }
  
      // Helper to get state abbreviation from a row 
      const getRowStateCode = (row) => {
        const fromAbbrev = (row["State abbreviation"] || row["State Abbreviation"] || "").toString().trim().toUpperCase();
        const fromState = (row["State"] || "").toString().trim().toUpperCase();
        return fromAbbrev || fromState;
      };
  
      // Filter rows for this state
      let facilities = ghgEmissionsCache.filter((row) => {
        return getRowStateCode(row) === stateCode;
      });
  
      // Optional: further filter by facility name if query provided
      if (facilityNameQuery) {
        facilities = facilities.filter((row) => {
          const facilityName = (row["Facility Name"] || "").toString().trim().toLowerCase();
          return facilityName.includes(facilityNameQuery);
        });
      }
  
      if (facilities.length === 0) {
        return res.status(404).json({ error: "No facilities found for this state" });
      }
  
      // Map to shape expected by GhgEmissionsMarkers.tsx
      const result = facilities.map((row, idx) => ({
        id: row["Facility ID"] || `${stateCode}-${idx}`,
        facilityName: row["Facility Name"] || "",
        industryType: row["Industry Type (sectors)"] || "",
        totalReportedDirectEmissions: row["Total reported direct emissions"] || "",
        co2EmissionsNonBiogenic: row["CO2 emissions (non-biogenic) "] || "",
        methaneEmissionsCH4: row["Methane (CH4) emissions "] || "",
        nitrousOxideEmissionsN2O: row["Nitrous Oxide (N2O) emissions"] || "",
        latitude: Number(row["Latitude"]),
        longitude: Number(row["Longitude"]),
      }));
  
      res.json({ ghgEmissions: result });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

const facilityCodes = {
    1: "Hazardous Waste Combustion Facilities",
    3: "Municipal Solid Waste (MSW) Combustion Facilities",
    4: "Medical/ Biohazardous Waste Incinerators",
    6: "Municipal Solid Waste (MSW) Landfills",
    9: "Publicly Owned Treatment Works (POTW)",
    10: "Federally Owned Treatment Works (FOTW)",
    16: "Electric Arc Furnaces",
    21: "Commercial Radioactive Waste Disposal Facilities",
    22: "Federal Radioactive Waste Disposal Facilities",
    30: "Industrial Waste Landfills",
    31: "Sewage Sludge Incinerators",
    34: "Composting",
    41: "Sewage Treatment Plants",
    42: "Cement Kilns",
    43: "Industrial Solid Waste Incineration Units"
}

// Facility type IDs whose data is updated from 2024+
const facilityTypeIDs = [
    1,  // Hazardous Waste Combustion Facilities 
    3,  // Municipal Solid Waste Landfills 
    9,  // Publicly Owned Treatment Works 
    10, // Federally Owned Treatment Works 
    16, // Electric Arc Furnaces 
    21, // Commercial Radioactive Waste Disposal Facilities 
    22, // Federal Radioactive Waste Disposal Facilities 
    30, // Industrial Waste Landfills 
    31, // Sewage Sludge Incinerators 
    34, // Composting 
    41, // Sewage Treatment Plants 
    42, // Cement Kilns 
    43  // Industrial Solid Waste Incineration Units 
]

// Return information on the various waste sites 
router.get('/wasteTreatmentDisposalSites', async(req, res) => {

    try {
        const stateCode = req.query.stateCode   

        if (!stateCode) {
            return res.status(400).json({ error: "Missing 'state code' query parameter"})
        }

        const promises = facilityTypeIDs.map(facilityId =>
            axios.get("https://iwaste.epa.gov/api/facilities", {
                params: {
                    facilityId: facilityId,
                    stateCode: stateCode,
                    format: "json"
                }
            })
        )

        // Get all the responses from the api
        const responses = await Promise.all(promises)

        // set used instead of array for faster lookup
        const seenIds = new Set()

        // Store all the facilities in an array with no duplicates
        const allFacilities = []
        responses.forEach(response => {
            const data = response.data?.data ?? []
            data.forEach(facility => {
                if (!seenIds.has(facility.id)) {
                    seenIds.add(facility.id)
                    allFacilities.push(facility)
                }
            })
        })

        // Clean data and format the response
        const result = allFacilities
            .filter(f => f.latitude != null && f.longitude != null)
            .map(f => {
                const facilitySubIds = (f.facilitySubtypeIds || "").toString().split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))   // split up string and convert to numbers
                const facilityType = facilitySubIds.map(id => facilityCodes[id]).filter(Boolean).join(", ") || null    // map the ids to the facility codes
                return {
                    id: f.id,
                    name: f.name ?? null,
                    city: f.city ?? null,
                    county: f.county ?? null,
                    address: [f.streetAddress, f.city, f.stateCode, f.zipCode].filter(Boolean).join(", ") || null,
                    latitude: parseFloat(f.latitude),
                    longitude: parseFloat(f.longitude),
                    facilityType: facilityType || null
                }
            })

        res.json(result)

    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to fetch facilities" })
    }

})

// Retrieve coal mine data inlcuding company, production type, and location
router.get('/coalmines', async(req, res) => {
    try {
        const stateCode = req.query.stateCode

        if(!stateCode) {
            return res.status(400).json({ error: "Missing 'state code' query parameter"})
        }

        // Fetch coal mine data
        const response = await axios.get("https://api.eia.gov/v2/coal/mine-production/data/", {
        params: {
            frequency: "annual",
            start: 2023,
            "data[]": [
              "latitude",
              "longitude",
              "operating-company",
              "production"
            ],
            "facets[mineStatusId][]": "ACT",
            "facets[stateId][]": stateCode,
            "sort[0][column]": "period",
            "sort[0][direction]": "desc",
            api_key: process.env.EIA_API_KEY
        } 
    })

        // Trim response to only include the requested fields
        const trimResponse = response.data.response.data.map(mine => ({
            mineName: mine.mineName,
            mineTypeDescription: mine.mineTypeDescription,
            mineStatusDescription: mine.mineStatusDescription,
            latitude: mine.latitude,
            longitude: mine.longitude,
            operatingCompany: mine["operating-company"],
            production: mine.production,
            productionUnits: mine["productionunits"]
        }))

        res.json(trimResponse)
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message })
    }
})

router.get('/oilSpills', async (req, res) => {
    try {
        // Check if we have data is already downloaded 
        if (!oilSpillsCache) {
            console.log("Downloading and processing oil spills data...");
            
            const url = "https://incidentnews.noaa.gov/raw/incidents.csv";

            // Fetch CSV as text
            const response = await axios.get(url, { responseType: "text" })
            const csvText = response.data

            // Parse CSV with papaparse
            const parsed = Papa.parse(csvText, {
                header: true,        // use first row as headers
                skipEmptyLines: true
            });

            // Cache the parsed data
            oilSpillsCache = parsed.data;
            console.log("Oil spills data cached successfully");
        }

        // Filter for spills in 2025 using cached data
        const spills2025 = oilSpillsCache.filter(row => {
            const dateStr = row.Date || row["open_date"] || "";
            if (!dateStr) return false;
            return new Date(dateStr).getFullYear() === 2025;
        });

        if (spills2025.length === 0) return res.status(404).json({ error: "No spills found for 2025" });

        // Return only the requested fields
        const allowedFields = ['id', 'open_date', 'name', 'location', 'lat', 'lon', 'threat', 'commodity', 'description'];
        const limitedSpills = spills2025.map(row => {
            const out = {};
            for (const key of allowedFields) {
                out[key] = row[key] ?? null;
            }
            return out;
        });

        res.json(limitedSpills);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
})


// Retrieve drinking water safety information and violations for public water systems
// Helps users understand if an area has safe drinking water or any violations
/*router.get('/drinkingWater', async(req, res) => {
    try {
        const stateCode = req.query.stateCode;
        const countyName = req.query.countyName;

        if(!stateCode) {
            return res.status(400).json({ error: "Missing 'stateCode' query parameter. Provide a 2-letter state code (e.g., 'CA', 'NY', 'TX')"})
        }

        // Build the EPA DMAP service URL
        // 'A' in pws_activity_code means Active systems
        // This query gets active water systems with their violations
        let url;
        if (countyName) {
            // Query by state and county
            url = `https://data.epa.gov/dmapservice/sdwis.water_system/state_code/equals/${stateCode}/county/equals/${encodeURIComponent(countyName)}/pws_activity_code/equals/A/left/sdwis.violation/pwsid/equals/pwsid/json`;
        } else {
            // Query by state only
            url = `https://data.epa.gov/dmapservice/sdwis.water_system/state_code/equals/${stateCode}/pws_activity_code/equals/A/left/sdwis.violation/pwsid/equals/pwsid/json`;
        }

        const response = await axios.get(url);
        const waterSystemsData = response.data;

        if (!waterSystemsData || waterSystemsData.length === 0) {
            return res.status(404).json({ 
                error: `No active public water systems found${countyName ? ` in ${countyName}, ${stateCode}` : ` in ${stateCode}`}` 
            });
        }

        // Deduplicate facilities by pwsid (keep only one instance per facility)
        const uniqueFacilities = {};
        waterSystemsData.forEach(system => {
            const pwsid = system.pwsid;
            if (!uniqueFacilities[pwsid]) {
                uniqueFacilities[pwsid] = system;
            } else {
                // If duplicate found, merge violations from both
                const existingViolations = uniqueFacilities[pwsid].sdwis_violation || [];
                const newViolations = system.sdwis_violation || [];
                uniqueFacilities[pwsid].sdwis_violation = [...existingViolations, ...newViolations];
            }
        });

        // Process the data to provide clear safety information
        const processedSystems = Object.values(uniqueFacilities).map(system => {
            let violations = system.sdwis_violation || [];
            
            // Sort violations by date (most recent first)
            violations.sort((a, b) => {
                const dateA = new Date(a.violation_date || 0);
                const dateB = new Date(b.violation_date || 0);
                return dateB - dateA; // Most recent first
            });

            // Filter out violations without valid dates for display purposes
            const validViolations = violations.filter(v => {
                if (!v.violation_date) return false;
                const date = new Date(v.violation_date);
                return !isNaN(date.getTime());
            });

            // Get the most recent violation date
            const mostRecentDate = validViolations.length > 0 && validViolations[0].violation_date 
                ? new Date(validViolations[0].violation_date) 
                : null;
            
            // Categorize violations by type
            // Compliance status codes: 'O' = Open/Active violation, 'K' = Known violation, 'R' = Resolved
            const activeViolations = validViolations.filter(v => 
                v.compliance_status_code === 'O' || v.compliance_status_code === 'K'
            );
            
            const resolvedViolations = validViolations.filter(v => 
                v.compliance_status_code === 'R'
            );

            // Check for recent violations (within last 5 years) even if resolved
            const fiveYearsAgo = new Date();
            fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
            const recentResolvedViolations = resolvedViolations.filter(v => {
                const vDate = new Date(v.violation_date);
                return vDate >= fiveYearsAgo;
            });

            // Determine safety status based on active violations and recent past violations
            let safetyStatus = 'safe';
            let safetyMessage = 'No active violations detected';
            
            if (activeViolations.length > 0) {
                // Check for health-based violations (more serious)
                const healthViolations = activeViolations.filter(v => 
                    v.violation_category_code === 'H' || 
                    v.violation_category_code === 'M' ||
                    v.contaminant_code // MCL violations
                );
                
                if (healthViolations.length > 0) {
                    safetyStatus = 'unsafe';
                    safetyMessage = `Active health-based violations detected. ${activeViolations.length} total active violation(s)`;
                } else {
                    safetyStatus = 'caution';
                    safetyMessage = `Active monitoring/reporting violations. ${activeViolations.length} active violation(s)`;
                }
            } else if (recentResolvedViolations.length > 0) {
                // If no active violations but recent resolved ones, show caution
                safetyStatus = 'caution';
                safetyMessage = `No active violations, but ${recentResolvedViolations.length} violation(s) resolved in the past 5 years`;
            }

            // Include all violations (both active and resolved) in the response
            const allViolations = [...activeViolations, ...resolvedViolations].map(v => ({
                violationId: v.violation_id,
                violationDate: v.violation_date,
                violationCategory: v.violation_category_code,
                violationCategoryDescription: v.violation_category_code === 'H' ? 'Health-based' :
                                              v.violation_category_code === 'M' ? 'Monitoring' :
                                              v.violation_category_code === 'R' ? 'Reporting' : 'Other',
                contaminantCode: v.contaminant_code || null,
                contaminantName: v.contaminant_name || null,
                complianceStatus: v.compliance_status_code,
                complianceStatusDescription: v.compliance_status_code === 'O' ? 'Open/Active' :
                                              v.compliance_status_code === 'K' ? 'Known' : 'Resolved'
            }));

            return {
                pwsId: system.pwsid,
                systemName: system.pws_name || 'Unknown',
                systemType: system.pws_type_code || 'Unknown',
                city: system.city || 'Unknown',
                county: system.county || 'Unknown',
                state: system.state_code || stateCode,
                zipCode: system.zip_code || null,
                populationServed: system.population_served_count || null,
                safetyStatus: safetyStatus,
                safetyMessage: safetyMessage,
                activeViolationsCount: activeViolations.length,
                resolvedViolationsCount: resolvedViolations.length,
                totalViolationsCount: allViolations.length,
                violations: allViolations,
                mostRecentViolationDate: mostRecentDate ? mostRecentDate.toISOString().split('T')[0] : null
            };
        });

        // Calculate overall area safety summary
        const systemsWithViolations = processedSystems.filter(s => s.safetyStatus !== 'safe');
        const overallStatus = systemsWithViolations.length === 0 ? 'safe' : 
                             processedSystems.some(s => s.safetyStatus === 'unsafe') ? 'unsafe' : 'caution';

        res.json({
            area: countyName ? `${countyName}, ${stateCode}` : stateCode,
            overallSafetyStatus: overallStatus,
            totalSystems: processedSystems.length,
            systemsWithViolations: systemsWithViolations.length,
            systems: processedSystems,
            summary: {
                safe: processedSystems.filter(s => s.safetyStatus === 'safe').length,
                caution: processedSystems.filter(s => s.safetyStatus === 'caution').length,
                unsafe: processedSystems.filter(s => s.safetyStatus === 'unsafe').length
            }
        });

    } catch (err) {
        console.error(err);
        if (err.response) {
            return res.status(err.response.status || 500).json({ 
                error: `Failed to fetch drinking water data: ${err.response.statusText || err.message}` 
            });
        }
        res.status(500).json({ error: err.message || "Failed to fetch drinking water data" });
    }  
})*/

// Retrieve recent natural disaster incidents (since 2024) for a specific state
router.get('/naturalDisasterIncidents', async (req, res) => {
    try {
        const stateCode = req.query.stateCode.toUpperCase();

        if (!stateCode) {
            return res.status(400).json({ error: "Missing 'stateCode' query parameter." });
        }

        // Filter by state and date to minimize payload
        const baseUrl = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries';
        const filter = `declarationDate ge '${DISASTER_START_DATE}' and state eq '${stateCode}'`;
        let allDeclarations = [];
        let skip = 0;
        const pageSize = 1000;
        let hasMore = true;

        // API has many pages of records so we need to go page by page to extract records
        try {
            while (hasMore) {
                const response = await axios.get(baseUrl, {
                    params: {
                        $filter: filter,
                        $top: pageSize,
                        $skip: skip,
                        $orderby: 'declarationDate desc',
                        $format: 'json'
                    }
                });

                if (!response.data || !response.data.DisasterDeclarationsSummaries) break;

                // Add declerations to array and check if there are more pages
                const declarations = response.data.DisasterDeclarationsSummaries;
                allDeclarations = allDeclarations.concat(declarations);
                hasMore = declarations.length === pageSize;
                if (hasMore) skip += pageSize;
            }
        } catch (error) {
            console.error(`Error fetching FEMA disaster declarations:`, error.message);
            return res.status(500).json({ 
                error: `Unable to fetch disaster data from FEMA OpenFEMA API`
            });
        }

        // Listed incident types 
        const INCIDENT_TYPES = new Set([
            'Biological', 'Coastal Storm', 'Dam/Levee Break', 'Earthquake', 'Fire', 'Flood',
            'Hurricane', 'Mud/Landslide', 'Other', 'Severe Ice Storm', 'Severe Storm', 'Snowstorm',
            'Straight-Line Winds', 'Tornado', 'Tropical Depression', 'Tropical Storm', 'Winter Storm'
        ]);

        // Filter incidents by type
        const filteredIncidents = allDeclarations.filter(incident => {
            const type = (incident.incidentType || '').trim();
            return type && INCIDENT_TYPES.has(type);
        });

        if (filteredIncidents.length === 0) {
            return res.status(404).json({ 
                error: `No natural disaster incidents found for state: ${stateCode} since 2024`
            });
        }

        // Sort by date (most recent first)
        filteredIncidents.sort((a, b) => {
            const dateA = a.declarationDate || a.incidentBeginDate || '';
            const dateB = b.declarationDate || b.incidentBeginDate || '';
            return dateB.localeCompare(dateA);
        });

        // Format the response - only include essential fields
        const formattedIncidents = filteredIncidents.map(incident => ({
            incidentType: incident.incidentType,
            state: incident.state,
            incidentBeginDate: incident.incidentBeginDate,
            incidentEndDate: incident.incidentEndDate,
            declarationTitle: incident.declarationTitle || incident.title,
            county: incident.designatedArea || null
        }));

        // Group by incident type for summary
        const byIncidentType = {};
        formattedIncidents.forEach(incident => {
            const type = incident.incidentType || 'Unknown';
            if (!byIncidentType[type]) {
                byIncidentType[type] = [];
            }
            byIncidentType[type].push(incident);
        });

        const today = new Date();
        res.json({
            state: stateCode,
            dateRange: {
                start: DISASTER_START_DATE,
                end: today.toISOString().split('T')[0],
                period: "Since 2024"
            },
            totalIncidents: formattedIncidents.length,
            incidentsByType: Object.keys(byIncidentType).map(type => ({
                type: type,
                count: byIncidentType[type].length
            })),
            incidents: formattedIncidents
        });

    } catch (error) {
        console.error(error);
        if (error.response) {
            return res.status(error.response.status || 500).json({ 
                error: "Failed to fetch natural disaster incidents response from api" 
            });
        }
        res.status(500).json({ error: error.message || "Failed to fetch natural disaster incidents data" });
    }
})

// Source: IM3 Open Source Data Center Atlas
// Data was manually downloaded so check for updates on the website
const DATACENTER_CSV_PATH = path.join(__dirname, "../datacenter.csv");

let dataCentersCache = null;

function loadDataCenters() {
    if (dataCentersCache) return dataCentersCache;

    // Read and parse csv file with papaparse
    const csvText = fs.readFileSync(DATACENTER_CSV_PATH, "utf-8");
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

    // Convert each row to an object (mainly for cleaning data)
    dataCentersCache = (parsed.data).map((row) => ({
        id: row.id || null,
        name: row.name || null,
        operator: row.operator || null,
        ref: row.ref || null,
        county: row.county || null,
        state: row.state_abb || row.state || null,
        state_abb: row.state_abb || null,
        sqft: row.sqft || null,
        lat: parseFloat(row.lat),
        lon: parseFloat(row.lon),
        type: row.type || null,
    })).filter((r) => !isNaN(r.lat) && !isNaN(r.lon));
    return dataCentersCache;
}

router.get("/dataCenters", async (req, res) => {
    try {
        const stateCode = (req.query.stateCode || "").toString().trim().toUpperCase();
        const allCenters = loadDataCenters();

        // show data centers for a specific state or all data centers if no state code is provided
        let dataCenters = stateCode
            ? allCenters.filter((r) => (r.state_abb || r.state || "").toUpperCase() === stateCode)
            : allCenters;

        if (stateCode && dataCenters.length === 0) {
            return res.status(404).json({ error: `No data centers found for state: ${stateCode}` });
        }

        res.json({
            source: "IM3 Open Source Data Center Atlas (MSD-LIVE)",
            attribution: "Data from OpenStreetMap, ODbL. Pacific Northwest National Laboratory, DOE.",
            total: dataCenters.length,
            dataCenters,
        });
    } catch (err) {
        console.error("Data centers route error:", err);
        if (err.code === "ENOENT") {
            return res.status(503).json({ error: "Data center dataset not available. Ensure datacenter.csv exists." });
        }
        res.status(500).json({ error: err.message || "Failed to load data center data" });
    }
})
export default router;