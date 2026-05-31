import { describe, expect, it, vi } from 'vitest'
import {
  clearServerCacheForTests,
  invalidateServerCache,
  withServerCache,
} from './server-cache.server'

describe('withServerCache', () => {
  it('returns cached value within TTL', async () => {
    clearServerCacheForTests()
    const fn = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2)

    expect(await withServerCache('test-key', 60_000, fn)).toBe(1)
    expect(await withServerCache('test-key', 60_000, fn)).toBe(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('invalidates by prefix', async () => {
    clearServerCacheForTests()
    const fn = vi.fn().mockResolvedValue(42)

    await withServerCache('cache:categories:tree', 60_000, fn)
    invalidateServerCache('cache:categories:')
    await withServerCache('cache:categories:tree', 60_000, fn)

    expect(fn).toHaveBeenCalledTimes(2)
  })
})
