/**
 * Process-local TTL cache for read-heavy server queries.
 * Single-instance deployments: sufficient for homepage/category stats.
 * Multi-instance: add Redis (REDIS_URL) or accept per-process cache.
 */

const store = new Map<string, { expiresAt: number; value: unknown }>()

export async function withServerCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const now = Date.now()
  const hit = store.get(key)
  if (hit && hit.expiresAt > now) {
    return hit.value as T
  }

  const value = await fn()
  store.set(key, { expiresAt: now + ttlMs, value })
  return value
}

/** Drop cached entries. Pass a prefix (e.g. `cache:categories:`) or omit to clear all. */
export function invalidateServerCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    store.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.startsWith(keyPrefix)) {
      store.delete(key)
    }
  }
}

/** @internal — reset between tests */
export function clearServerCacheForTests(): void {
  store.clear()
}
