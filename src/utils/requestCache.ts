interface CacheEntry {
  data: unknown;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 60_000,
): Promise<T> {
  const entry = cache.get(key);
  const now = Date.now();

  if (entry && now - entry.fetchedAt < ttlMs) {
    return entry.data as T;
  }

  const data = await fetcher();
  cache.set(key, { data, fetchedAt: now });
  return data;
}
