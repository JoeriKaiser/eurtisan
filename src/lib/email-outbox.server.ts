/**
 * Durable email outbox.
 *
 * All non-interactive transactional emails are inserted into `email_outbox`
 * instead of being sent directly. The outbox worker drains pending rows,
 * handles retries, and writes outcomes to `email_send_log`.
 */

import { and, eq, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { emailOutbox } from '#/db/schema'
import type { EmailTemplate } from '#/lib/email-provider'
import type { EmailCategory } from '#/lib/email-preferences.server'
import { sha256Hex } from '#/lib/hash.server'
import { logger } from '#/lib/logger.server'
import { emailQueuedTotal } from '#/lib/metrics.server'
import type { SerializableValue } from '#/lib/notifications.server'

export interface EnqueueEmailOptions {
  to: string
  userId: string
  template: EmailTemplate
  data: Record<string, SerializableValue>
  category: EmailCategory
  idempotencyKey: string
  locale?: string
  scheduledAt?: Date
  maxRetries?: number
}

export interface EmailOutboxRow {
  id: string
  userId: string | null
  idempotencyKey: string
  recipientHash: string
  template: EmailTemplate
  locale: string
  data: Record<string, SerializableValue>
  category: EmailCategory
  status: (typeof emailOutbox.$inferSelect.status)[number]
  scheduledAt: Date
  sentAt: Date | null
  provider: string | null
  providerMessageId: string | null
  failureReason: string | null
  retryCount: number
  maxRetries: number
  nextRetryAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Insert an email into the durable outbox.
 *
 * Idempotency is enforced at the database level via `idempotencyKey`. When a
 * row with the same key already exists, the existing id is returned without
 * throwing.
 */
export async function enqueueEmail(
  options: EnqueueEmailOptions,
): Promise<{ id: string; alreadyExists: boolean }> {
  const normalizedEmail = normalizeEmail(options.to)
  const recipientHash = await sha256Hex(normalizedEmail)
  const idempotencyKey = options.idempotencyKey

  const values: typeof emailOutbox.$inferInsert = {
    userId: options.userId,
    idempotencyKey,
    recipientHash,
    template: options.template,
    locale: options.locale ?? 'en',
    data: options.data,
    category: options.category,
    status: 'pending',
    scheduledAt: options.scheduledAt ?? new Date(),
    maxRetries: options.maxRetries ?? 3,
  }

  const inserted = await db
    .insert(emailOutbox)
    .values(values)
    .onConflictDoNothing({ target: emailOutbox.idempotencyKey })
    .returning({ id: emailOutbox.id })

  if (inserted.length > 0) {
    emailQueuedTotal.inc({ template: options.template })
    return { id: inserted[0].id, alreadyExists: false }
  }

  const existing = await db
    .select({ id: emailOutbox.id })
    .from(emailOutbox)
    .where(eq(emailOutbox.idempotencyKey, idempotencyKey))
    .limit(1)

  const existingId = existing[0]?.id
  if (existingId) {
    logger.info('[email-outbox] idempotency key collision; returning existing row', {
      idempotencyKey,
      existingId,
    })
  }

  return { id: existingId ?? '', alreadyExists: true }
}

/**
 * Fetch the next batch of pending emails that are eligible to send.
 */
export async function getPendingOutboxBatch(limit: number): Promise<EmailOutboxRow[]> {
  const now = new Date()
  const rows = await db
    .select()
    .from(emailOutbox)
    .where(
      and(
        eq(emailOutbox.status, 'pending'),
        lte(emailOutbox.scheduledAt, now),
        or(isNull(emailOutbox.nextRetryAt), lte(emailOutbox.nextRetryAt, now)),
      ),
    )
    .orderBy(emailOutbox.scheduledAt)
    .limit(limit)
    .for('update', { skipLocked: true })

  return rows as EmailOutboxRow[]
}

/**
 * Reset rows that were left in `sending` state by a crashed worker.
 */
export async function resetStuckSendingRows(stuckThresholdMinutes = 5): Promise<{ reset: number }> {
  const result = await db
    .update(emailOutbox)
    .set({ status: 'pending', updatedAt: new Date() })
    .where(
      and(
        eq(emailOutbox.status, 'sending'),
        lte(emailOutbox.updatedAt, sql`now() - INTERVAL '1 minute' * ${stuckThresholdMinutes}`),
      ),
    )

  return { reset: result.rowCount ?? 0 }
}

export async function markOutboxSending(id: string): Promise<void> {
  await db
    .update(emailOutbox)
    .set({ status: 'sending', updatedAt: new Date() })
    .where(eq(emailOutbox.id, id))
}

export async function markOutboxSent(
  id: string,
  provider: string,
  providerMessageId: string,
): Promise<void> {
  await db
    .update(emailOutbox)
    .set({
      status: 'sent',
      provider,
      providerMessageId,
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(emailOutbox.id, id))
}

export async function markOutboxFailed(
  id: string,
  reason: string,
  nextRetryAt?: Date,
  retryCount?: number,
): Promise<void> {
  await db
    .update(emailOutbox)
    .set({
      status: 'pending',
      failureReason: reason,
      nextRetryAt: nextRetryAt ?? null,
      retryCount: retryCount ?? sql`${emailOutbox.retryCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(emailOutbox.id, id))
}

export async function markOutboxSuppressed(id: string, reason: string): Promise<void> {
  await db
    .update(emailOutbox)
    .set({
      status: 'suppressed',
      failureReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(emailOutbox.id, id))
}

export async function markOutboxMaxRetriesReached(
  id: string,
  reason: string,
  retryCount: number,
): Promise<void> {
  await db
    .update(emailOutbox)
    .set({
      status: 'failed',
      failureReason: reason,
      retryCount,
      updatedAt: new Date(),
    })
    .where(eq(emailOutbox.id, id))
}

/**
 * Delete pending outbox rows for a specific user. Used during account deletion
 * so emails are not sent to an address that is about to be anonymized.
 */
export async function deletePendingOutboxRowsForUser(
  userId: string,
  tx: Omit<typeof db, '$client'> = db,
): Promise<{ deleted: number }> {
  const result = await tx
    .delete(emailOutbox)
    .where(and(eq(emailOutbox.userId, userId), eq(emailOutbox.status, 'pending')))

  return { deleted: result.rowCount ?? 0 }
}

/**
 * Test helper that drains all currently pending outbox rows synchronously.
 *
 * See `flushBackgroundWorkForTests()` for the equivalent background-work helper.
 */
export async function flushEmailOutboxForTests(): Promise<void> {
  const { processOutboxBatch } = await import('#/jobs/email-outbox-worker')
  let processed = 0
  do {
    processed = await processOutboxBatch(100)
  } while (processed > 0)
}
