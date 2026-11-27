import axios from "axios";
import { getCached, mapWithConcurrency } from "../utils/dataCache.js";

const RTB_BASE_URL = "https://cdn.statically.io/gh/komed3/rtb-api/main/api";

const CACHE_KEY = "rtb:billionaires:US:profiles:v2";
const CACHE_MS = 24 * 60 * 60 * 1000;
const PROFILE_CONCURRENCY = 10;
const FILTER_REQUEST_TIMEOUT_MS = 60000;
const PROFILE_REQUEST_TIMEOUT_MS = 15000;

export async function fetchUsBillionaireProfiles(client = axios) {
  const filterResponse = await client.get(
    `${RTB_BASE_URL}/filter/country/us`,
    {
      headers: { Accept: "application/json" },
      timeout: FILTER_REQUEST_TIMEOUT_MS,
    }
  );

  const profileUris = filterResponse.data;
  if (!Array.isArray(profileUris)) {
    throw new Error("Unexpected response while loading U.S. billionaire profile URIs");
  }

  const profiles = await mapWithConcurrency(profileUris, PROFILE_CONCURRENCY, async (uri) => {
    let profileResponse;
    try {
      profileResponse = await client.get(
        `${RTB_BASE_URL}/profile/${uri}/info`,
        {
          headers: { Accept: "application/json" },
          timeout: PROFILE_REQUEST_TIMEOUT_MS,
        }
      );
    } catch (error) {
      if (error?.response?.status === 404) return null;
      throw error;
    }

    if (profileResponse.status === 404) return null;

    const profile =
      typeof profileResponse.data === "string"
        ? JSON.parse(profileResponse.data)
        : profileResponse.data;
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      throw new Error(`Unexpected profile response for ${uri}`);
    }
    return profile;
  });

  return profiles.filter((profile) => profile !== null);
}

export function getUsBillionaireProfiles(
  client = axios
) {
  return getCached(
    CACHE_KEY,
    CACHE_MS,
    () => fetchUsBillionaireProfiles(client)
  );
}