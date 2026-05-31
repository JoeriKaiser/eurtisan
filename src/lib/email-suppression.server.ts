import { eq, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { emailSuppression } from '#/db/schema'
import { logger } from './logger.server'

export type EmailSuppressionReason = 'hard_bounce' | 'soft_bounce' | 'spam' | 'blocked' | 'invalid'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Returns true when the address must not receive mail. */
export async function isEmailSuppressed(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email)
  if (!normalized) return false

  const [row] = await db
    .select({ email: emailSuppression.email })
    .from(emailSuppression)
    .where(eq(emailSuppression.email, normalized))
    .limit(1)

  return !!row
}

/** Record or update a suppression entry from a provider webhook. */
export async function suppressEmail(
  email: string,
  reason: EmailSuppressionReason,
  source?: string,
): Promise<void> {
  const normalized = normalizeEmail(email)
  if (!normalized) return

  await db
    .insert(emailSuppression)
    .values({
      email: normalized,
      reason,
      source: source ?? null,
    })
    .onConflictDoUpdate({
      target: emailSuppression.email,
      set: {
        reason,
        source: source ?? null,
        updatedAt: sql`now()`,
      },
    })

  logger.warn('[email] address suppressed', {
    reason,
    source,
    alert: reason === 'hard_bounce' || reason === 'spam',
  })
}
