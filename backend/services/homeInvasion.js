const DEFAULT_FBI_CDE_BASE_URL = "https://cde.ucr.cjis.gov/LATEST";

export const HOME_INVASION_OFFENSES = Object.freeze({
  robbery: { code: "ROB", label: "Robbery" },
  burglary: { code: "BUR", label: "Burglary/Breaking & Entering" },
});

export const HOME_INVASION_MIN_YEAR = 1991;
export const HOME_INVASION_LATEST_YEAR = Number(
  process.env.FBI_NIBRS_LATEST_YEAR || 2026,
);

export function parseHomeInvasionQuery(query) {
  const year = Number(query.year ?? HOME_INVASION_LATEST_YEAR);

  if (!Number.isInteger(year) || year < HOME_INVASION_MIN_YEAR || year > HOME_INVASION_LATEST_YEAR) {
    return {
      error: `Year must be between ${HOME_INVASION_MIN_YEAR} and ${HOME_INVASION_LATEST_YEAR}.`,
    };
  }
  return { year };
}

export function buildHomeInvasionUrl({ state, year, offense, apiKey, baseUrl }) {
  const normalizedBaseUrl = (baseUrl || DEFAULT_FBI_CDE_BASE_URL).replace(/\/$/, "");
  const offenseCode = HOME_INVASION_OFFENSES[offense]?.code;
  if (!offenseCode) {
    throw new Error(`Unsupported home invasion offense: ${offense}`);
  }

  const url = new URL(`${normalizedBaseUrl}/nibrs/state/${state}/${offenseCode}`);
  url.searchParams.set("from", `01-${year}`);
  url.searchParams.set("to", `12-${year}`);
  url.searchParams.set("type", "totals");
  url.searchParams.set("API_KEY", apiKey);
  return url.toString();
}

export function readResidentialCount(payload) {
  const count = payload?.victim?.location?.["Residence/Home"];
  if (!Number.isFinite(Number(count))) {
    throw new Error("FBI NIBRS response did not include a Residence/Home count.");
  }
  return Number(count);
}

export async function fetchHomeInvasionState({
  state,
  year,
  apiKey,
  fetchJson,
  baseUrl,
}) {
  const counts = {};
  // Keep each state's upstream requests sequential to stay below the FBI rate limit.
  for (const offense of Object.keys(HOME_INVASION_OFFENSES)) {
    const url = buildHomeInvasionUrl({ state, year, offense, apiKey, baseUrl });
    const payload = await fetchJson(url);
    counts[offense] = readResidentialCount(payload);
  }

  return {
    robbery: counts.robbery,
    burglary: counts.burglary,
    total: counts.robbery + counts.burglary,
    reported: true,
  };
}

export function getHomeInvasionDefinition() {
  return "Robbery and burglary/breaking-and-entering offenses reported by NIBRS with a Residence/Home location.";
}
