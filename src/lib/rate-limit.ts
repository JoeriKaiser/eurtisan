import { createMiddleware } from '@tanstack/react-start'
import { sql } from 'drizzle-orm'

/* -------------------------------------------------------------------------- */
/*  Environment detection                                                     */
/* -------------------------------------------------------------------------- */

function isTestEnvironment(): boolean {
  return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test'
}

/* -------------------------------------------------------------------------- */
/*  IP extraction                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Extract the most trustworthy client IP from request headers.
 *
 * Priority:
 * 1. `X-Real-Ip` — typically set and overwritten by the immediate reverse proxy,
 *    making it harder to spoof than `X-Forwarded-For`.
 * 2. Last IP in `X-Forwarded-For` — added by the closest proxy; more trustworthy
 *    than the first IP, which can be trivially spoofed by the client.
 * 3. Fallback to `'unknown'`.
 *
 * Production deployments should run behind a proxy that sanitises these headers.
 */
export function extractClientIp(request: Request): string {
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const ips = forwarded.split(',').map((ip) => ip.trim())
    return ips[ips.length - 1]
  }

  return 'unknown'
}

/* -------------------------------------------------------------------------- */
/*  Core rate-limit check                                                     */
/* -------------------------------------------------------------------------- */

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  retryAfterSeconds: number
}

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

  const { db } = await import('#/db/index')

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
async function assertRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
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
/*  Middleware factories                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Create middleware that rate-limits by client IP.
 */
export function createIpRateLimitMiddleware(limit: number, windowMs: number, prefix: string) {
  return createMiddleware({ type: 'request' }).server(async ({ request, next }) => {
    const ip = extractClientIp(request)
    const key = `${prefix}:${ip}`
    await assertRateLimit(key, limit, windowMs)
    return next()
  })
}

/**
 * Create middleware that rate-limits by authenticated user ID.
 * Falls back to IP when the user is not authenticated.
 */
export function createUserRateLimitMiddleware(limit: number, windowMs: number, prefix: string) {
  return createMiddleware({ type: 'request' }).server(async ({ request, next, context }) => {
    const userId =
      context && typeof context === 'object' && 'user' in context
        ? (((context as Record<string, unknown>).user as { id: string } | undefined)?.id ?? null)
        : null

    if (userId) {
      const key = `${prefix}:${userId}`
      await assertRateLimit(key, limit, windowMs)
    } else {
      const ip = extractClientIp(request)
      const key = `${prefix}:ip:${ip}`
      await assertRateLimit(key, limit, windowMs)
    }

    return next()
  })
}

/* -------------------------------------------------------------------------- */
/*  Auth endpoint helpers                                                     */
/* -------------------------------------------------------------------------- */

const AUTH_ACTION_PATHS = new Set([
  '/api/auth/sign-in/email',
  '/api/auth/sign-up/email',
  '/api/auth/forget-password',
  '/api/auth/reset-password',
])

/**
 * Determine whether a request targets an auth action that should be rate-limited.
 */
export function isAuthRateLimitedAction(request: Request): boolean {
  if (request.method !== 'POST') return false
  try {
    const url = new URL(request.url)
    return AUTH_ACTION_PATHS.has(url.pathname)
  } catch {
    return false
  }
}

/**
 * Rate-limit helper for the catch-all auth handler.
 */
export async function assertAuthRateLimit(request: Request): Promise<void> {
  if (!isAuthRateLimitedAction(request)) return
  const ip = extractClientIp(request)
  await assertRateLimit(`auth:${ip}`, 5, 60_000)
}
