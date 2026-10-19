import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { createClient } from "redis";

const store = new Map();
const inFlight = new Map();

const DEFAULT_DATA_POINT_CACHE_TTL_SECONDS = 60 * 60;
const DEFAULT_MEMORY_CACHE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

function getDataPointCacheTtlSeconds() {
  const configuredTtl = process.env.REDIS_TTL_SECONDS?.trim();

  if (!configuredTtl) {
    return DEFAULT_DATA_POINT_CACHE_TTL_SECONDS;
  }

  const ttlSeconds = Number(configuredTtl);

  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) {
    console.warn(
      "[datapoint-cache] REDIS_TTL_SECONDS must be a positive integer; " +
        "using the 3600-second default."
    );

    return DEFAULT_DATA_POINT_CACHE_TTL_SECONDS;
  }

  return ttlSeconds;
}

const DATA_POINT_CACHE_TTL_SECONDS = getDataPointCacheTtlSeconds();

// -----------------------------------------------------------------------------
// Redis
// -----------------------------------------------------------------------------

let redisClient;
let redisConnectPromise;

function getRedisClient() {
  const redisUrl = process.env.REDIS_URL?.trim();

  if (!redisUrl) {
    return null;
  }

  if (!redisClient) {
    redisClient = createClient({
      url: redisUrl,

      socket: {
        reconnectStrategy(retries) {
          // Exponential-ish retry capped at 5 seconds.
          return Math.min(retries * 100, 5000);
        },
      },
    });

    redisClient.on("error", (error) => {
      console.error(
        "[datapoint-cache] Redis client error:",
        error.message
      );
    });

    redisClient.on("reconnecting", () => {
      console.warn("[datapoint-cache] Reconnecting to Redis...");
    });

    redisClient.on("ready", () => {
      console.info("[datapoint-cache] Redis ready.");
    });
  }

  return redisClient;
}

export async function connectDataPointRedis() {
  const client = getRedisClient();

  if (!client) {
    console.info(
      "[datapoint-cache] REDIS_URL not configured; Redis caching disabled."
    );
    return;
  }

  if (client.isReady || client.isOpen) {
    return;
  }

  if (redisConnectPromise) {
    return redisConnectPromise;
  }

  redisConnectPromise = client
    .connect()
    .catch((error) => {
      console.warn(
        "[datapoint-cache] Redis connection failed; continuing without Redis:",
        error.message
      );
    })
    .finally(() => {
      redisConnectPromise = null;
    });

  return redisConnectPromise;
}

// -----------------------------------------------------------------------------
// Cache key
// -----------------------------------------------------------------------------

/**
 * Generates a cache key based ONLY on the requested resource.
 *
 * IMPORTANT:
 * Data-point endpoints using this middleware MUST be user-independent.
 *
 * The cache key intentionally does NOT include:
 * - Authorization headers
 * - Cookies
 * - User IDs
 * - Sessions
 * - IP addresses
 *
 * Two users requesting the same resource therefore receive the same cached
 * response.
 */
function createDataPointCacheKey(req) {
  const url = new URL(req.originalUrl, "http://localhost");

  // Sort query parameters so:
  //
  // ?state=AZ&year=2025
  //
  // and
  //
  // ?year=2025&state=AZ
  //
  // use the same cache entry.

  const params = [...url.searchParams.entries()].sort(([aKey, aValue], [bKey, bValue]) => {
    const keyComparison = aKey.localeCompare(bKey);

    if (keyComparison !== 0) {
      return keyComparison;
    }

    return aValue.localeCompare(bValue);
  });

  const normalizedParams = new URLSearchParams();

  for (const [key, value] of params) {
    normalizedParams.append(key, value);
  }

  const normalizedUrl =
    url.pathname +
    (normalizedParams.size > 0
      ? `?${normalizedParams.toString()}`
      : "");

  const hash = createHash("sha256")
    .update(normalizedUrl)
    .digest("hex");

  return `datapoints:${hash}`;
}

// -----------------------------------------------------------------------------
// Express Redis middleware
// -----------------------------------------------------------------------------

/**
 * Caches successful JSON responses from public/user-independent data-point
 * routes.
 *
 * Redis is optional. Redis failures must never cause an otherwise valid
 * request to fail.
 */
export async function cacheDataPointResponse(req, res, next) {
  const requestStartedAt = performance.now();
  const requestUrl = req.originalUrl.split("?")[0];

  // Only cache GET requests.
  if (req.method !== "GET") {
    return next();
  }

  // Don't cache test/status endpoints.
  if (/(?:^|\/)(?:test|status)\/?$/.test(requestUrl)) {
    return next();
  }

  const client = getRedisClient();

  if (!client) {
    return next();
  }

  // If Redis isn't currently available, continue serving requests normally.
  //
  // If the client isn't already trying to connect, trigger a connection
  // attempt without blocking this request.
  if (!client.isReady) {
    if (!client.isOpen) {
      void connectDataPointRedis();
    }

    return next();
  }

  const key = createDataPointCacheKey(req);

  // ---------------------------------------------------------------------------
  // Read cache
  // ---------------------------------------------------------------------------

  try {
    const cached = await client.get(key);

    if (cached !== null) {
      try {
        const result = JSON.parse(cached);

        if (
          Number.isInteger(result.statusCode) &&
          result.statusCode >= 200 &&
          result.statusCode < 300 &&
          Object.hasOwn(result, "body")
        ) {
          const durationMs = (performance.now() - requestStartedAt).toFixed(2);
          console.log(
            `[datapoint-cache] HIT ${requestUrl} (${durationMs} ms)`
          );

          return res
            .status(result.statusCode)
            .json(result.body);
        }

        console.warn(
          `[datapoint-cache] Invalid cache entry for ${requestUrl}; deleting it.`
        );

        // Don't block the request while deleting the invalid value.
        void client.del(key).catch(() => {});
      } catch {
        console.warn(
          `[datapoint-cache] Corrupt cache entry for ${requestUrl}; deleting it.`
        );

        void client.del(key).catch(() => {});
      }
    } else {
      console.log(`[datapoint-cache] MISS ${requestUrl}`);
    }
  } catch (error) {
    console.warn(
      "[datapoint-cache] Redis read failed; bypassing cache:",
      error.message
    );
  }

  // ---------------------------------------------------------------------------
  // Capture JSON response
  // ---------------------------------------------------------------------------

  const originalJson = res.json.bind(res);

  res.json = function cachedJson(body) {
    const statusCode = res.statusCode;

    // Only cache successful responses.
    if (
      statusCode >= 200 &&
      statusCode < 300 &&
      client.isReady
    ) {
      try {
        const serialized = JSON.stringify({
          statusCode,
          body,
        });

        // Don't make the response wait for Redis.
        void client
          .set(key, serialized, {
            EX: DATA_POINT_CACHE_TTL_SECONDS,
          })
          .catch((error) => {
            console.warn(
              "[datapoint-cache] Redis write failed:",
              error.message
            );
          });
      } catch (error) {
        console.warn(
          "[datapoint-cache] Could not serialize response:",
          error.message
        );
      }
    }

    return originalJson(body);
  };

  return next();
}

// -----------------------------------------------------------------------------
// In-memory upstream cache
// -----------------------------------------------------------------------------

/**
 * Serves a cached value, fetching it at most once per TTL.
 *
 * Concurrent callers requesting the same key share the same Promise.
 */
export function getCached(key, ttlMs, fetchFn) {
  const now = Date.now();
  const entry = store.get(key);

  if (entry) {
    if (now - entry.cachedAt <= ttlMs) {
      return Promise.resolve(entry.data);
    }

    // Remove expired entries instead of leaving them around.
    store.delete(key);
  }

  // Another request is already fetching this resource.
  const pending = inFlight.get(key);

  if (pending) {
    return pending;
  }

  const promise = (async () => {
    try {
      const data = await fetchFn();

      store.set(key, {
        data,
        cachedAt: Date.now(),
        ttlMs,
      });

      return data;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);

  return promise;
}

// -----------------------------------------------------------------------------
// Periodic memory cache cleanup
// -----------------------------------------------------------------------------

const cleanupTimer = setInterval(() => {
  const now = Date.now();

  for (const [key, entry] of store) {
    if (now - entry.cachedAt > entry.ttlMs) {
      store.delete(key);
    }
  }
}, DEFAULT_MEMORY_CACHE_CLEANUP_INTERVAL_MS);

// Don't keep Node alive just because of the cleanup timer.
cleanupTimer.unref?.();

// -----------------------------------------------------------------------------
// Concurrency limiter
// -----------------------------------------------------------------------------

/**
 * Like Promise.all(items.map(task)), except only `limit` tasks execute at once.
 */
export async function mapWithConcurrency(items, limit, task) {
  if (items.length === 0) {
    return [];
  }

  const concurrency = Math.max(
    1,
    Math.min(limit, items.length)
  );

  const results = new Array(items.length);
  let next = 0;

  const workers = Array.from(
    { length: concurrency },
    async () => {
      while (true) {
        const index = next++;

        if (index >= items.length) {
          break;
        }

        results[index] = await task(
          items[index],
          index
        );
      }
    }
  );

  await Promise.all(workers);

  return results;
}