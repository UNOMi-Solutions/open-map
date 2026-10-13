const store = new Map();
const inFlight = new Map();

/**
 * Serves a cached value, fetching it at most once per TTL. Concurrent callers
 * that arrive during a fetch share the same promise, so a burst of map layers
 * hitting a cold instance triggers one upstream download instead of dozens.
 */
export function getCached(key, ttlMs, fetchFn) {
  const entry = store.get(key);
  if (entry && Date.now() - entry.cachedAt <= ttlMs) {
    return Promise.resolve(entry.data);
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const data = await fetchFn();
    store.set(key, { data, cachedAt: Date.now() });
    return data;
  })();

  inFlight.set(
    key,
    promise.finally(() => inFlight.delete(key))
  );

  return promise;
}

/**
 * Like Promise.all(items.map(task)) but with at most `limit` tasks running at
 * once. Upstream government APIs answer a 50-state fan-out with 429s, and the
 * unbounded version also spikes memory on the container.
 */
export async function mapWithConcurrency(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;

  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await task(items[index], index);
      }
    }
  );

  await Promise.all(workers);
  return results;
}
