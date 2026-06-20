/**
 * Rate limiting for auth-triggered emails.
 *
 * Uses the existing `rate_limit` table and fixed-window counters.
 */

import {
  getEmailRateLimitPasswordResetPerEmailDay,
  getEmailRateLimitSecurityAlertPerEmailHour,
  getEmailRateLimitVerificationPerEmailDay,
} from '#/lib/env.server'
import { sha256Hex } from '#/lib/hash.server'
import { logger } from '#/lib/logger.server'
import { checkRateLimitDb } from '#/lib/rate-limit'

export type AuthEmailType = 'password_reset' | 'email_verification' | 'account_security_alert'

interface LimitConfig {
  limit: number
  windowMs: number
}

function getLimitConfig(type: AuthEmailType): LimitConfig {
  switch (type) {
    case 'password_reset':
      return {
        limit: getEmailRateLimitPasswordResetPerEmailDay(),
        windowMs: 24 * 60 * 60 * 1000,
      }
    case 'email_verification':
      return {
        limit: getEmailRateLimitVerificationPerEmailDay(),
        windowMs: 24 * 60 * 60 * 1000,
      }
    case 'account_security_alert':
      return {
        limit: getEmailRateLimitSecurityAlertPerEmailHour(),
        windowMs: 60 * 60 * 1000,
      }
  }
}

function getBucketTimestamp(windowMs: number): string {
  const now = Date.now()
  const bucketStart = Math.floor(now / windowMs) * windowMs
  return String(bucketStart)
}

/**
 * Check whether an auth email may be sent.
 *
 * Enforces per-email limits. Per-IP limits are intentionally not implemented
 * here because Better Auth callbacks do not receive the request object; they
 * should be enforced at the route/middleware layer when a request context is
 * available.
 */
export async function checkAuthEmailRateLimit(
  email: string,
  type: AuthEmailType,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const normalizedEmail = email.trim().toLowerCase()
  const { limit, windowMs } = getLimitConfig(type)
  const bucket = getBucketTimestamp(windowMs)
  const key = `email:${type}:${normalizedEmail}:${bucket}`

  const result = await checkRateLimitDb(key, limit, windowMs)

  if (!result.allowed) {
    logger.warn('[email-rate-limit] auth email rate limit exceeded', {
      type,
      emailHash: await sha256Hex(normalizedEmail),
      retryAfterSeconds: result.retryAfterSeconds,
    })
    return { allowed: false, retryAfter: result.retryAfterSeconds }
  }

  return { allowed: true }
}
