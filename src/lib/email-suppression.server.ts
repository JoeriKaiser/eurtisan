import { and, eq, gte, isNull, or, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { emailSuppression } from '#/db/schema'
import { logger } from './logger.server'

export type EmailSuppressionReason = 'hard_bounce' | 'soft_bounce' | 'spam' | 'blocked' | 'invalid'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Returns true when the address must not receive mail. Expired suppressions
 * (soft bounces with a past `expiresAt`) are ignored.
 */
export async function isEmailSuppressed(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email)
  if (!normalized) return false

  const [row] = await db
    .select({ email: emailSuppression.email })
    .from(emailSuppression)
    .where(
      and(
        eq(emailSuppression.email, normalized),
        or(isNull(emailSuppression.expiresAt), gte(emailSuppression.expiresAt, new Date())),
      ),
    )
    .limit(1)

  return !!row
}

export interface SuppressEmailOptions {
  reason: EmailSuppressionReason
  source?: string
  expiresAt?: Date
}

/** Record or update a suppression entry from a provider webhook. */
export async function suppressEmail(
  email: string,
  reason: EmailSuppressionReason,
  source?: string,
): Promise<void>
export async function suppressEmail(email: string, options: SuppressEmailOptions): Promise<void>
export async function suppressEmail(
  email: string,
  reasonOrOptions: EmailSuppressionReason | SuppressEmailOptions,
  source?: string,
): Promise<void> {
  const normalized = normalizeEmail(email)
  if (!normalized) return

  let reason: EmailSuppressionReason
  let effectiveSource: string | undefined
  let expiresAt: Date | undefined

  if (typeof reasonOrOptions === 'string') {
    reason = reasonOrOptions
    effectiveSource = source
  } else {
    reason = reasonOrOptions.reason
    effectiveSource = reasonOrOptions.source
    expiresAt = reasonOrOptions.expiresAt
  }

  await db
    .insert(emailSuppression)
    .values({
      email: normalized,
      reason,
      source: effectiveSource ?? null,
      expiresAt: expiresAt ?? null,
    })
    .onConflictDoUpdate({
      target: emailSuppression.email,
      set: {
        reason,
        source: effectiveSource ?? null,
        expiresAt: expiresAt ?? null,
        updatedAt: sql`now()`,
      },
    })

  logger.warn('[email] address suppressed', {
    reason,
    source: effectiveSource,
    alert: reason === 'hard_bounce' || reason === 'spam',
  })
}
