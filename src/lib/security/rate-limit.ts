import { createMiddleware } from '@tanstack/react-start'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  retryAfterSeconds: number
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
/*  Middleware factories                                                      */
/* -------------------------------------------------------------------------- */

async function assertServerRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const { assertRateLimit } = await import('./rate-limit.server')
  await assertRateLimit(key, limit, windowMs)
}

/**
 * Create middleware that rate-limits by client IP.
 */
export function createIpRateLimitMiddleware(limit: number, windowMs: number, prefix: string) {
  return createMiddleware({ type: 'request' }).server(async ({ request, next }) => {
    const ip = extractClientIp(request)
    const key = `${prefix}:${ip}`
    await assertServerRateLimit(key, limit, windowMs)
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
      await assertServerRateLimit(key, limit, windowMs)
    } else {
      const ip = extractClientIp(request)
      const key = `${prefix}:ip:${ip}`
      await assertServerRateLimit(key, limit, windowMs)
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
  '/api/auth/change-password',
  '/api/auth/delete-user',
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
