/**
 * Tests for auth email rate limiting.
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { rateLimit } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'

import { checkAuthEmailRateLimit } from './rate-limit.server'

beforeEach(async () => {
  await clearTestTables()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('checkAuthEmailRateLimit', () => {
  it('allows the first few requests', async () => {
    const result = await checkAuthEmailRateLimit('alice@example.com', 'password_reset')
    expect(result.allowed).toBe(true)
  })

  it('blocks after the per-email daily limit is exceeded', async () => {
    for (let i = 0; i < 5; i++) {
      const result = await checkAuthEmailRateLimit('bob@example.com', 'password_reset')
      expect(result.allowed).toBe(true)
    }

    const blocked = await checkAuthEmailRateLimit('bob@example.com', 'password_reset')
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })

  it('uses independent counters per email address', async () => {
    for (let i = 0; i < 5; i++) {
      await checkAuthEmailRateLimit('carol@example.com', 'password_reset')
    }

    const other = await checkAuthEmailRateLimit('dan@example.com', 'password_reset')
    expect(other.allowed).toBe(true)
  })

  it('uses independent counters per email type', async () => {
    for (let i = 0; i < 5; i++) {
      await checkAuthEmailRateLimit('eve@example.com', 'password_reset')
    }

    const verification = await checkAuthEmailRateLimit('eve@example.com', 'email_verification')
    expect(verification.allowed).toBe(true)
  })

  it('resets the counter when the window rolls over', async () => {
    vi.setSystemTime(0)
    for (let i = 0; i < 5; i++) {
      await checkAuthEmailRateLimit('frank@example.com', 'password_reset')
    }

    const blocked = await checkAuthEmailRateLimit('frank@example.com', 'password_reset')
    expect(blocked.allowed).toBe(false)

    // Move to the next day bucket
    vi.setSystemTime(24 * 60 * 60 * 1000 + 1)
    const nextWindow = await checkAuthEmailRateLimit('frank@example.com', 'password_reset')
    expect(nextWindow.allowed).toBe(true)
  })

  it('records rate-limit rows in the database', async () => {
    vi.setSystemTime(0)
    await checkAuthEmailRateLimit('grace@example.com', 'account_security_alert')

    const rows = await db
      .select()
      .from(rateLimit)
      .where(eq(rateLimit.key, 'email:account_security_alert:grace@example.com:0'))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.count).toBe(1)
  })
})
