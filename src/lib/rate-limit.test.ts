import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { rateLimit } from '#/db/schema'
import {
  checkRateLimit,
  checkRateLimitDb,
  extractClientIp,
  isAuthRateLimitedAction,
} from './rate-limit'

beforeEach(async () => {
  await db.delete(rateLimit)
})

afterAll(async () => {
  await db.delete(rateLimit)
})

describe('extractClientIp', () => {
  it('extracts the last IP from x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
    })
    expect(extractClientIp(req)).toBe('10.0.0.1')
  })

  it('extracts IP from x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '10.0.0.5' },
    })
    expect(extractClientIp(req)).toBe('10.0.0.5')
  })

  it('prefers x-real-ip over x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '1.2.3.4',
        'x-real-ip': '5.6.7.8',
      },
    })
    expect(extractClientIp(req)).toBe('5.6.7.8')
  })

  it('returns unknown when no headers are present', () => {
    const req = new Request('http://localhost')
    expect(extractClientIp(req)).toBe('unknown')
  })
})

describe('isAuthRateLimitedAction', () => {
  it('returns true for POST /api/auth/sign-in/email', () => {
    const req = new Request('http://localhost/api/auth/sign-in/email', { method: 'POST' })
    expect(isAuthRateLimitedAction(req)).toBe(true)
  })

  it('returns true for POST /api/auth/sign-up/email', () => {
    const req = new Request('http://localhost/api/auth/sign-up/email', { method: 'POST' })
    expect(isAuthRateLimitedAction(req)).toBe(true)
  })

  it('returns true for POST /api/auth/forget-password', () => {
    const req = new Request('http://localhost/api/auth/forget-password', { method: 'POST' })
    expect(isAuthRateLimitedAction(req)).toBe(true)
  })

  it('returns true for POST /api/auth/reset-password', () => {
    const req = new Request('http://localhost/api/auth/reset-password', { method: 'POST' })
    expect(isAuthRateLimitedAction(req)).toBe(true)
  })

  it('returns false for GET requests', () => {
    const req = new Request('http://localhost/api/auth/sign-in/email', { method: 'GET' })
    expect(isAuthRateLimitedAction(req)).toBe(false)
  })

  it('returns false for other auth paths', () => {
    const req = new Request('http://localhost/api/auth/sign-out', { method: 'POST' })
    expect(isAuthRateLimitedAction(req)).toBe(false)
  })
})

describe('checkRateLimit (test environment)', () => {
  it('always allows in test environment', async () => {
    const result = await checkRateLimit('test-key', 5, 60_000)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(5)
  })
})

describe('checkRateLimitDb (database-backed)', () => {
  it('allows the first request and sets count to 1', async () => {
    const result = await checkRateLimitDb('db-test', 5, 60_000)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)

    const rows = await db.select().from(rateLimit).where(eq(rateLimit.key, 'db-test'))
    expect(rows).toHaveLength(1)
    expect(rows[0].count).toBe(1)
  })

  it('allows requests up to the limit', async () => {
    const key = 'limit-test'
    const limit = 3

    for (let i = 0; i < limit; i++) {
      const result = await checkRateLimitDb(key, limit, 60_000)
      expect(result.allowed).toBe(true)
    }

    const rows = await db.select().from(rateLimit).where(eq(rateLimit.key, key))
    expect(rows[0].count).toBe(limit)
  })

  it('blocks requests beyond the limit', async () => {
    const key = 'block-test'
    const limit = 2

    await checkRateLimitDb(key, limit, 60_000)
    await checkRateLimitDb(key, limit, 60_000)

    const result = await checkRateLimitDb(key, limit, 60_000)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('resets the counter when the window expires', async () => {
    const key = 'window-test'
    const limit = 2
    const windowMs = 1000
    const t0 = 0

    // Exhaust the limit
    await checkRateLimitDb(key, limit, windowMs, t0)
    await checkRateLimitDb(key, limit, windowMs, t0)
    const blocked = await checkRateLimitDb(key, limit, windowMs, t0)
    expect(blocked.allowed).toBe(false)

    // Move to the next window
    const t1 = t0 + windowMs + 1
    const result = await checkRateLimitDb(key, limit, windowMs, t1)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(limit - 1)
  })

  it('returns consistent retry-after values for blocked requests', async () => {
    const key = 'retry-test'
    const windowMs = 60_000
    const nowMs = 30_000 // halfway through the window

    await checkRateLimitDb(key, 1, windowMs, nowMs)
    const blocked = await checkRateLimitDb(key, 1, windowMs, nowMs)

    expect(blocked.allowed).toBe(false)
    // Window ends at 60_000, so retry-after should be ~30 seconds
    expect(blocked.retryAfterSeconds).toBe(30)
  })

  it('never exceeds the limit under concurrent requests', async () => {
    const key = 'concurrent-test'
    const limit = 3
    const windowMs = 60_000

    // Fire 10 requests in parallel
    const results = await Promise.all(
      Array.from({ length: 10 }, () => checkRateLimitDb(key, limit, windowMs)),
    )

    const allowed = results.filter((r) => r.allowed)
    const blocked = results.filter((r) => !r.allowed)

    expect(allowed.length).toBe(limit)
    expect(blocked.length).toBe(10 - limit)
  })
})
