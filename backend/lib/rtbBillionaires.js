import axios from "axios";
import { getCached, mapWithConcurrency } from "../utils/dataCache.js";

const RTB_BASE_URL = "https://cdn.statically.io/gh/komed3/rtb-api/main/api";

const CACHE_KEY = "rtb:billionaires:US:profiles";
const CACHE_MS = 24 * 60 * 60 * 1000;
const PROFILE_CONCURRENCY = 10;
const REQUEST_TIMEOUT_MS = 30000;

function requireSuccessfulResponse(response, url) {
  if (
    !Number.isInteger(response?.status) ||
    response.status < 200 ||
    response.status >= 300
  ) {
    throw new Error(
      `RTB request to ${url} returned HTTP ${
        response?.status ?? "unknown"
      }`
    );
  }

  return response.data;
}

function getBillionaireEntries(data) {
  const entries = Array.isArray(data)
    ? data
    : data?.billionaires ??
      data?.results ??
      data?.data;

  if (!Array.isArray(entries)) {
    throw new Error(
      "RTB country filter returned an unexpected response"
    );
  }

  return entries;
}

function getProfileUri(entry) {
  // API may return the URI directly
  if (typeof entry === "string") {
    return entry.trim() || null;
  }

  // Or as part of an object
  const uri =
    entry?.uri ??
    entry?.profileUri ??
    entry?.id;

  return typeof uri === "string" && uri.trim()
    ? uri.trim()
    : null;
}

async function getJson(client, url) {
  const response = await client.get(url, {
    headers: {
      Accept: "application/json",
    },
    timeout: REQUEST_TIMEOUT_MS,
  });

  return requireSuccessfulResponse(response, url);
}

export async function fetchUsBillionaireProfiles(
  client = axios
) {
  // V2 COUNTRY FILTER
  const filterUrl =
    `${RTB_BASE_URL}/filter/country/US.json`;

  const filterData = await getJson(client, filterUrl);

  const entries = getBillionaireEntries(filterData);

  const people = entries.map((entry) => ({
    entry,
    uri: getProfileUri(entry),
  }));

  const eligiblePeople = people.filter(
    ({ uri }) => uri
  );

  for (const { entry, uri } of people) {
    if (!uri) {
      console.warn(
        "[rtbBillionaires] Skipping entry without URI:",
        entry
      );
    }
  }

  if (
    entries.length > 0 &&
    eligiblePeople.length === 0
  ) {
    throw new Error(
      "RTB country filter returned entries without profile URIs"
    );
  }

  // Fetch complete profiles with max 10 concurrent requests
  const profiles = await mapWithConcurrency(
    eligiblePeople,
    PROFILE_CONCURRENCY,
    async ({ uri }) => {
      // V2 PROFILE ENDPOINT
      const profileUrl =
        `${RTB_BASE_URL}/profile/` +
        `${encodeURIComponent(uri)}/profile.json`;

      try {
        const profile = await getJson(
          client,
          profileUrl
        );

        if (
          !profile ||
          typeof profile !== "object" ||
          Array.isArray(profile)
        ) {
          throw new Error(
            "RTB profile response was not an object"
          );
        }

        return profile;
      } catch (error) {
        console.warn(
          `[rtbBillionaires] Failed profile ${uri}:`,
          error.message
        );

        return null;
      }
    }
  );

  const successfulProfiles = profiles.filter(
    (profile) => profile !== null
  );

  if (
    eligiblePeople.length > 0 &&
    successfulProfiles.length === 0
  ) {
    throw new Error(
      "RTB did not return any billionaire profiles successfully"
    );
  }

  return successfulProfiles;
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