import { apiGet } from "./apiClient";

const CACHE_PREFIX = "openmap-api-cache:v1:";
/** localStorage is typically ~5MB per origin; skip huge payloads (missing persons, police killings). */
const MAX_CACHE_BYTES = 4 * 1024 * 1024;

interface CacheEnvelope<T> {
  data: T;
  cachedAt: number;
}

/** Default TTLs for cached API responses (milliseconds). */
export const CACHE_TTL = {
  /** Crime aggregates, arrests, missing persons — changes infrequently. */
  CRIME: 24 * 60 * 60 * 1000,
  /** Law enforcement incident datasets. */
  LAW_ENFORCEMENT: 24 * 60 * 60 * 1000,
  /** Global environment datasets (oil spills, data centers). */
  ENVIRONMENT_GLOBAL: 24 * 60 * 60 * 1000,
  /** Per-state environment datasets. */
  ENVIRONMENT_STATE: 12 * 60 * 60 * 1000,
  /** Air quality — refresh more often. */
  AIR_QUALITY: 2 * 60 * 60 * 1000,
  /** Politics - refreshes infrequently */
  POLITICS: 24 * 60 * 60 * 1000,
} as const;

function storageKey(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

function readCache<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (Date.now() - envelope.cachedAt > ttlMs) return null;
    return envelope.data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    const envelope: CacheEnvelope<T> = { data, cachedAt: Date.now() };
    const serialized = JSON.stringify(envelope);
    if (serialized.length > MAX_CACHE_BYTES) {
      console.info(
        `[apiCache] Skipping localStorage cache for ${key} (${(serialized.length / 1024 / 1024).toFixed(1)}MB exceeds limit)`,
      );
      return;
    }
    localStorage.setItem(storageKey(key), serialized);
  } catch (err) {
    console.warn("[apiCache] Failed to write cache for", key, err);
  }
}

/**
 * GET an API path, returning a cached copy from localStorage when still fresh.
 * @param cacheKey Stable identifier (e.g. `crime:murderByState`, `env:ghg:CA`)
 * @param path API path including query string if needed
 * @param ttlMs Max age before refetching
 */
export async function cachedApiGet<T>(
  cacheKey: string,
  path: string,
  ttlMs: number,
  options?: { forceRefresh?: boolean },
): Promise<T> {
  if (!options?.forceRefresh) {
    const cached = readCache<T>(cacheKey, ttlMs);
    if (cached !== null) return cached;
  }

  const data = await apiGet<T>(path);
  writeCache(cacheKey, data);
  return data;
}

/** Parallel cached GETs — useful for per-state fetches (natural disasters, air quality). */
export async function cachedApiGetBatch<T>(
  requests: Array<{ cacheKey: string; path: string }>,
  ttlMs: number,
): Promise<T[]> {
  return Promise.all(
    requests.map(({ cacheKey, path }) => cachedApiGet<T>(cacheKey, path, ttlMs)),
  );
}

/** Remove a single cache entry (useful after data refresh scripts). */
export function invalidateApiCache(cacheKey: string): void {
  try {
    localStorage.removeItem(storageKey(cacheKey));
  } catch {
    /* ignore */
  }
}
