import axios from "axios";

const SNP_API_URL =
    "https://www.wikitable2json.com/api/List_of_S%26P_500_companies?table=0";

const CITY_TO_ZIP_URL =
    "https://api.zippopotam.us";

const REQUEST_TIMEOUT_MS = 30000;

// Limit concurrent company enrichment operations.
const ENRICHMENT_CONCURRENCY = 5;

/**
 * Returns S&P 500 companies with headquarters geolocation.
 */
export async function getSNP500Companies(client = axios) {
    try {
        const response = await client.get(SNP_API_URL, {
            timeout: REQUEST_TIMEOUT_MS,
        });

        console.log(`Fetched S&P 500 companies from ${SNP_API_URL}`);

        if (response.status !== 200) {
            throw new Error(
                `Request to ${SNP_API_URL} returned HTTP ${response.status}`
            );
        }

        const companies = parseWikiTable(response.data);

        const enrichedCompanies = await mapWithConcurrency(
            companies,
            ENRICHMENT_CONCURRENCY,
            async (company) => {
                const headquartersLocation =
                    getHeadquartersLocation(company);

                const geolocation = await cityToGeolocation(
                    client,
                    headquartersLocation
                );

                return {
                    ...company,
                    StockholdersEquity: null,
                    Geolocation: geolocation,
                };
            }
        );

        return enrichedCompanies;
    } catch (error) {
        console.error(
            `Error fetching S&P 500 companies: ${error.message}`
        );

        return [];
    }
}


/**
 * Extracts the headquarters city/state from the S&P dataset.
 */
function getHeadquartersLocation(company) {
    const city = company.City ?? company.city;
    const state = company.State ?? company.state;

    if (city && state) {
        return {
            city: cleanLocationValue(city),
            state: cleanLocationValue(state),
        };
    }

    const headquarters =
        company["Headquarters Location"];

    const firstLocation =
        headquarters?.split(";")[0]?.trim();
    const separator =
        firstLocation?.lastIndexOf(",") ?? -1;

    if (separator <= 0) {
        return null;
    }

    return {
        city: cleanLocationValue(firstLocation
            .slice(0, separator)
            .trim()),

        state: cleanLocationValue(firstLocation
            .slice(separator + 1)
            .trim()),
    };
}

function cleanLocationValue(value) {
    return String(value ?? "")
        .replace(/\[\d+\]/g, "")
        .trim();
}


const US_STATE_ABBREVIATIONS = {
    Alabama: "AL",
    Alaska: "AK",
    Arizona: "AZ",
    Arkansas: "AR",
    California: "CA",
    Colorado: "CO",
    Connecticut: "CT",
    Delaware: "DE",
    "District of Columbia": "DC",
    Florida: "FL",
    Georgia: "GA",
    Hawaii: "HI",
    Idaho: "ID",
    Illinois: "IL",
    Indiana: "IN",
    Iowa: "IA",
    Kansas: "KS",
    Kentucky: "KY",
    Louisiana: "LA",
    Maine: "ME",
    Maryland: "MD",
    Massachusetts: "MA",
    Michigan: "MI",
    Minnesota: "MN",
    Mississippi: "MS",
    Missouri: "MO",
    Montana: "MT",
    Nebraska: "NE",
    Nevada: "NV",
    "New Hampshire": "NH",
    "New Jersey": "NJ",
    "New Mexico": "NM",
    "New York": "NY",
    "North Carolina": "NC",
    "North Dakota": "ND",
    Ohio: "OH",
    Oklahoma: "OK",
    Oregon: "OR",
    Pennsylvania: "PA",
    "Rhode Island": "RI",
    "South Carolina": "SC",
    "South Dakota": "SD",
    Tennessee: "TN",
    Texas: "TX",
    Utah: "UT",
    Vermont: "VT",
    Virginia: "VA",
    Washington: "WA",
    "West Virginia": "WV",
    Wisconsin: "WI",
    Wyoming: "WY",
};


function getStateAbbreviation(state) {
    const normalizedState = cleanLocationValue(state)
        .replace(/\./g, "")
        .trim();

    if (["DC", "District of Columbia"].includes(normalizedState)) {
        return "DC";
    }

    if (/^[A-Za-z]{2}$/.test(normalizedState)) {
        return normalizedState.toUpperCase();
    }

    return US_STATE_ABBREVIATIONS[normalizedState] ?? null;
}


function getCityCandidates(city) {
    const candidates = [city];
    const saintCity = city.replace(/\bSt\.?\s/gi, "Saint ");
    const fortCity = city.replace(/\bFt\.?\s/gi, "Fort ");
    const withoutMunicipality = city.replace(
        /\s+(township|town|borough|village|city)$/i,
        ""
    );

    candidates.push(saintCity, fortCity, withoutMunicipality);

    if (/^Upper\s+/i.test(withoutMunicipality)) {
        candidates.push(withoutMunicipality.replace(/^Upper\s+/i, ""));
    }

    return [...new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))];
}


/**
 * Normalizes city/state names for comparison.
 */
function normalizeLocation(value) {
    return String(value ?? "")
        .toLowerCase()
        .replace(/\bst\./g, "saint")
        .replace(/\bst\b/g, "saint")
        .replace(/\bft\./g, "fort")
        .replace(/\bft\b/g, "fort")
        .replace(/[^a-z0-9]/g, "");
}


function citiesMatch(headquartersCity, placeCity) {
    const headquarters =
        normalizeLocation(headquartersCity);

    const place =
        normalizeLocation(placeCity);

    return (
        headquarters === place ||
        headquarters.replace(/city$/, "") === place ||
        place.replace(/city$/, "") === headquarters
    );
}


/**
 * Runs asynchronous operations with limited concurrency.
 *
 * This prevents hundreds of geolocation requests from being
 * sent simultaneously.
 */
async function mapWithConcurrency(
    items,
    concurrency,
    callback
) {
    const results = new Array(items.length);

    let nextIndex = 0;

    async function worker() {
        while (true) {
            const index = nextIndex++;

            if (index >= items.length) {
                return;
            }

            results[index] =
                await callback(items[index], index);
        }
    }

    const workerCount = Math.min(
        concurrency,
        items.length
    );

    await Promise.all(
        Array.from(
            { length: workerCount },
            () => worker()
        )
    );

    return results;
}


/**
 * Converts wikitable2json's table/row arrays into company records.
 */
function parseWikiTable(tables) {
    const table = tables?.[0];

    if (!Array.isArray(table) || table.length < 2) {
        throw new Error("Unexpected response from wikitable2json");
    }

    const [headers, ...rows] = table;

    if (
        !Array.isArray(headers) ||
        !headers.includes("Symbol") ||
        !headers.includes("CIK")
    ) {
        throw new Error("S&P 500 table is missing required columns");
    }

    return rows
        .filter((row) => Array.isArray(row))
        .map((values) => {
            const company = {};

            headers.forEach((header, index) => {
                const value = values[index]?.trim();
                company[header] = value || null;
            });

            return company;
        });
}


/**
 * Resolves a US headquarters city to its ZIP code and coordinates.
 */
async function cityToGeolocation(client, headquartersLocation) {
    const state = getStateAbbreviation(
        headquartersLocation?.state
    );

    if (!headquartersLocation?.city || !state) {
        return null;
    }

    for (const city of getCityCandidates(headquartersLocation.city)) {
        const url = [
            CITY_TO_ZIP_URL,
            "us",
            encodeURIComponent(state.toLowerCase()),
            encodeURIComponent(city.toLowerCase()),
        ].join("/");

        let response;

        try {
            response = await client.get(url, {
                timeout: REQUEST_TIMEOUT_MS,
            });
        } catch (error) {
            if (error.response?.status === 404) {
                continue;
            }

            console.error(
                `Error fetching geolocation for headquarters city ${headquartersLocation.city}, ${headquartersLocation.state}: ${error.message}`
            );
            return null;
        }

        if (response.status === 404) {
            continue;
        }

        if (response.status !== 200) {
            console.error(
                `Request to ${url} returned HTTP ${response.status}`
            );
            return null;
        }

        const places = response.data?.places ?? [];
        const place = places.find((candidate) => {
            return citiesMatch(city, candidate["place name"] ?? "");
        }) ?? places[0];

        if (!place) {
            continue;
        }

        const latitude = Number(place.latitude);
        const longitude = Number(place.longitude);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            continue;
        }

        return {
            latitude,
            longitude,
            zipCode: place["post code"] ?? null,
            city: place["place name"] ?? null,
            state:
                place["state abbreviation"] ??
                place.state ??
                null,
        };
    }

    return null;
}