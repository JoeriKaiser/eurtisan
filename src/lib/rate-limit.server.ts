import { sql } from 'drizzle-orm'

import { db } from '#/db/index'
import { getRateLimitRetentionDays } from './env.server'
import { extractClientIp, isAuthRateLimitedAction, type RateLimitResult } from './rate-limit'

function isTestEnvironment(): boolean {
  return (
    process.env.VITEST === 'true' ||
    process.env.NODE_ENV === 'test' ||
    process.env.E2E_TEST === 'true'
  )
}

/* -------------------------------------------------------------------------- */
/*  Core rate-limit check                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Internal implementation that always hits the database.
 * Exposed so tests can verify window behaviour regardless of env.
 */
export async function checkRateLimitDb(
  key: string,
  limit: number,
  windowMs: number,
  nowMs = Date.now(),
): Promise<RateLimitResult> {
  const windowStart = new Date(Math.floor(nowMs / windowMs) * windowMs)
  const resetAt = new Date(windowStart.getTime() + windowMs)
  const retryAfterSeconds = Math.max(0, Math.ceil((resetAt.getTime() - nowMs) / 1000))

  // Atomic upsert: increments count in a single statement, eliminating the
  // read-modify-write race condition. When the window has rolled over the
  // counter is reset to 1; otherwise it is incremented by 1.
  const result = await db.execute(sql`
    INSERT INTO rate_limit (id, key, window_start, count, created_at, updated_at)
    VALUES (${crypto.randomUUID()}, ${key}, ${windowStart}, 1, now(), now())
    ON CONFLICT (key) DO UPDATE SET
      window_start = CASE
        WHEN rate_limit.window_start <> EXCLUDED.window_start THEN EXCLUDED.window_start
        ELSE rate_limit.window_start
      END,
      count = CASE
        WHEN rate_limit.window_start <> EXCLUDED.window_start THEN 1
        ELSE rate_limit.count + 1
      END,
      updated_at = now()
    RETURNING count, window_start
  `)

  const row = result.rows[0] as { count: number; window_start: Date }
  const count = row.count

  // Best-effort cleanup of stale rows — do not await and swallow errors
  // so that rate-limiting never fails because of cleanup.
  const retentionDays = getRateLimitRetentionDays()
  db.execute(sql`
    DELETE FROM rate_limit
    WHERE updated_at < now() - INTERVAL '1 day' * ${retentionDays}
  `).catch(() => {
    // Intentionally swallowed
  })

  if (count > limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterSeconds,
    }
  }

  return {
    allowed: true,
    remaining: limit - count,
    resetAt,
    retryAfterSeconds: 0,
  }
}

/**
 * Check a rate limit using a fixed window stored in PostgreSQL.
 *
 * @param key       Unique rate-limit key (e.g. "auth:192.168.1.1")
 * @param limit     Maximum allowed requests in the window
 * @param windowMs  Window size in milliseconds
 * @returns         RateLimitResult indicating allowance and metadata
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (isTestEnvironment()) {
    return {
      allowed: true,
      remaining: limit,
      resetAt: new Date(Date.now() + windowMs),
      retryAfterSeconds: 0,
    }
  }

  return checkRateLimitDb(key, limit, windowMs)
}

/**
 * Convenience wrapper that throws a 429 Response when the limit is exceeded.
 */
export async function assertRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const result = await checkRateLimit(key, limit, windowMs)
  if (!result.allowed) {
    throw new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(result.retryAfterSeconds),
        },
      },
    )
  }
}

/* -------------------------------------------------------------------------- */
/*  Auth endpoint helpers                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Assert per-email rate limit for auth actions.
 * Defaults to 3 attempts per 15 minutes.
 */
export async function assertEmailRateLimit(email: string): Promise<void> {
  const key = `auth:email:${email.toLowerCase()}`
  await assertRateLimit(key, 3, 900_000)
}

/**
 * Assert per-user rate limit using the user ID as the key.
 */
export async function assertUserRateLimit(
  userId: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const key = `user:${userId}`
  await assertRateLimit(key, limit, windowMs)
}

/**
 * Rate-limit helper for the catch-all auth handler.
 * When an email is provided, also applies stricter per-email limits.
 */
export async function assertAuthRateLimit(request: Request, email?: string): Promise<void> {
  if (!isAuthRateLimitedAction(request)) return
  const ip = extractClientIp(request)
  await assertRateLimit(`auth:${ip}`, 5, 60_000)
  if (email) {
    await assertEmailRateLimit(email)
  }
}
