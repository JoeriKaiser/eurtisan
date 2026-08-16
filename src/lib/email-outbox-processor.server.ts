/**
 * Email outbox processor.
 *
 * Core logic for draining pending outbox rows, sending via configured provider,
 * retry backoff, and logging.
 */
import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { user } from '#/db/schema'
import { createEmailProvider } from '#/integrations/email'
import {
  getPendingOutboxBatch,
  markOutboxFailed,
  markOutboxMaxRetriesReached,
  markOutboxSending,
  markOutboxSent,
  markOutboxSuppressed,
  resetStuckSendingRows,
  type EmailOutboxRow,
} from '#/lib/email-outbox.server'
import { getEmailHeaders } from '#/lib/email-headers.server'
import { isEmailEnabledForUser } from '#/lib/email-preferences.server'
import { logEmailEvent } from '#/lib/email-send-log.server'
import { isEmailSuppressed } from '#/lib/email-suppression.server'
import { decrypt } from '#/lib/encryption.server'
import { getBaseUrl, getEmailMaxRetries } from '#/lib/env.server'
import { logger } from '#/lib/logger.server'
import { emailFailedTotal, emailSentTotal, emailSuppressedSkipsTotal } from '#/lib/metrics.server'

export async function sendOutboxRow(row: EmailOutboxRow): Promise<void> {
  const maxRetries = row.maxRetries ?? getEmailMaxRetries()
  const provider = createEmailProvider()

  const [recipientUser] = row.userId
    ? await db
        .select({ email: user.email, deletedAt: user.deletedAt })
        .from(user)
        .where(eq(user.id, row.userId))
        .limit(1)
    : [null]

  const guestRecipientEmail = row.recipientEmail ? decrypt(row.recipientEmail) : null
  if ((!recipientUser || recipientUser.deletedAt) && !guestRecipientEmail) {
    await markOutboxMaxRetriesReached(row.id, 'recipient user not found or deleted', row.maxRetries)
    emailFailedTotal.inc({ template: row.template })
    await logEmailEvent({
      outboxId: row.id,
      recipientHash: row.recipientHash,
      template: row.template,
      category: row.category,
      provider: provider.name,
      status: 'failed',
      statusDetail: 'recipient user not found or deleted',
    })
    return
  }

  const recipientEmail = recipientUser?.email ?? guestRecipientEmail
  if (!recipientEmail) return

  if (await isEmailSuppressed(recipientEmail)) {
    emailSuppressedSkipsTotal.inc()
    await markOutboxSuppressed(row.id, 'recipient suppressed')
    await logEmailEvent({
      outboxId: row.id,
      recipientHash: row.recipientHash,
      template: row.template,
      category: row.category,
      provider: provider.name,
      status: 'suppressed',
      statusDetail: 'recipient suppressed',
    })
    return
  }

  const enabled = row.userId ? await isEmailEnabledForUser(row.userId, row.category) : true
  if (!enabled) {
    await markOutboxSuppressed(row.id, 'category disabled')
    await logEmailEvent({
      outboxId: row.id,
      recipientHash: row.recipientHash,
      template: row.template,
      category: row.category,
      provider: provider.name,
      status: 'skipped',
      statusDetail: 'category disabled',
    })
    return
  }

  const headers = await getEmailHeaders(recipientEmail, row.template, row.category)

  await markOutboxSending(row.id)

  try {
    const templateData = { ...row.data, locale: row.locale } as Record<string, unknown>
    if (row.template === 'guest_order_access') {
      const encryptedAccessToken = templateData.encryptedAccessToken
      if (typeof encryptedAccessToken !== 'string') {
        throw new Error('Guest-order access email is missing its encrypted token')
      }
      const token = decrypt(encryptedAccessToken)
      templateData.accessUrl = `${getBaseUrl()}/guest-order-access?token=${encodeURIComponent(token)}`
      delete templateData.encryptedAccessToken
    }
    const result = await provider.sendTransactional(
      recipientEmail,
      row.template,
      templateData,
      headers,
    )

    await markOutboxSent(row.id, provider.name, result.messageId)
    emailSentTotal.inc({ template: row.template })
    await logEmailEvent({
      outboxId: row.id,
      recipientHash: row.recipientHash,
      template: row.template,
      category: row.category,
      provider: provider.name,
      providerMessageId: result.messageId,
      status: 'accepted',
    })
    logger.info('outbox.worker.send', {
      outboxId: row.id,
      provider: provider.name,
      template: row.template,
      messageId: result.messageId,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    const nextRetryCount = row.retryCount + 1

    if (nextRetryCount >= maxRetries) {
      await markOutboxMaxRetriesReached(row.id, errorMessage, nextRetryCount)
      emailFailedTotal.inc({ template: row.template })
      await logEmailEvent({
        outboxId: row.id,
        recipientHash: row.recipientHash,
        template: row.template,
        category: row.category,
        provider: provider.name,
        status: 'failed',
        statusDetail: errorMessage,
      })
    } else {
      const delayMs = Math.min(2 ** nextRetryCount * 30_000, 60 * 60 * 1000)
      const nextRetryAt = new Date(Date.now() + delayMs)
      await markOutboxFailed(row.id, errorMessage, nextRetryAt, nextRetryCount)
      logger.warn('outbox.worker.failure', {
        outboxId: row.id,
        template: row.template,
        retryCount: nextRetryCount,
        nextRetryAt,
        error: errorMessage,
      })
    }
  }
}

export async function processOutboxBatch(batchSize: number): Promise<number> {
  const rows = await getPendingOutboxBatch(batchSize)

  let processed = 0
  let failed = 0

  for (const row of rows) {
    try {
      await sendOutboxRow(row)
      processed += 1
    } catch (err) {
      failed += 1
      logger.error('outbox.worker.row error', err, {
        outboxId: row.id,
        template: row.template,
      })
    }
  }

  if (rows.length > 0) {
    logger.info('outbox.worker.batch', { count: rows.length, processed, failed })
  }

  return rows.length
}

export async function processEmailOutboxTick(
  batchSize: number,
  tickCounter: number,
): Promise<void> {
  if (tickCounter % 6 === 1) {
    const result = await resetStuckSendingRows(5)
    if (result.reset > 0) {
      logger.info('outbox.worker.reset_stuck', { count: result.reset, job: 'email-outbox-worker' })
    }
  }

  await processOutboxBatch(batchSize)
}
