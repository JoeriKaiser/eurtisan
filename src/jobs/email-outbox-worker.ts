/**
 * Email outbox worker.
 *
 * Drains pending rows from `email_outbox`, handles retries with exponential
 * backoff, and records every outcome in `email_send_log`.
 *
 * Configuration:
 *   EMAIL_OUTBOX_WORKER_INTERVAL_MS — polling interval (default: 10000)
 *   EMAIL_OUTBOX_WORKER_BATCH_SIZE  — max rows per tick (default: 50)
 *
 * Usage:
 *   bun run src/jobs/email-outbox-worker.ts
 */

import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { user } from '#/db/schema'
import { createEmailProvider } from '#/integrations/email'
import {
  deletePendingOutboxRowsForUser,
  getPendingOutboxBatch,
  markOutboxFailed,
  markOutboxMaxRetriesReached,
  markOutboxSending,
  markOutboxSent,
  markOutboxSuppressed,
  resetStuckSendingRows,
  type EmailOutboxRow,
} from '#/lib/email-outbox.server'
import { decrypt } from '#/lib/encryption.server'
import { getEmailHeaders } from '#/lib/email-headers.server'
import { isEmailEnabledForUser } from '#/lib/email-preferences.server'
import { logEmailEvent } from '#/lib/email-send-log.server'
import { isEmailSuppressed } from '#/lib/email-suppression.server'
import {
  getBaseUrl,
  getEmailMaxRetries,
  getEmailOutboxWorkerBatchSize,
  getEmailOutboxWorkerIntervalMs,
} from '#/lib/env.server'
import { withJobLock } from '#/lib/job-lock.server'
import { logger } from '#/lib/logger.server'
import { emailFailedTotal, emailSentTotal, emailSuppressedSkipsTotal } from '#/lib/metrics.server'
import { declareJobInterval, withJobMetrics } from '#/lib/with-job-metrics.server'

const INTERVAL_MS = getEmailOutboxWorkerIntervalMs()
const BATCH_SIZE = getEmailOutboxWorkerBatchSize()
const MAX_RETRIES = getEmailMaxRetries()
const STUCK_RESET_TICKS = 6 // Reset stuck rows every ~INTERVAL_MS * 6

const JOB_NAME = 'email-outbox-worker'

let isRunning = true
let tickCount = 0

async function sendOutboxRow(row: EmailOutboxRow): Promise<void> {
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
    const maxRetries = row.maxRetries ?? MAX_RETRIES

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

/**
 * Process one batch of pending outbox rows. Exported so tests can drain the
 * outbox synchronously via `flushEmailOutboxForTests()`.
 */
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

async function tick(): Promise<void> {
  tickCount += 1

  if (tickCount % STUCK_RESET_TICKS === 1) {
    const result = await resetStuckSendingRows(5)
    if (result.reset > 0) {
      logger.info('outbox.worker.reset_stuck', { count: result.reset, job: JOB_NAME })
    }
  }

  await processOutboxBatch(BATCH_SIZE)
}

async function run(): Promise<void> {
  logger.info(
    `[email-outbox-worker] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE}, maxRetries=${MAX_RETRIES})`,
    {
      job: JOB_NAME,
      intervalMs: INTERVAL_MS,
      batchSize: BATCH_SIZE,
      maxRetries: MAX_RETRIES,
    },
  )

  // Declares the cadence EurtisanJobStale measures this job against.
  declareJobInterval(JOB_NAME, INTERVAL_MS)

  // Run immediately on start, then on every interval.
  await withJobMetrics(JOB_NAME, tick)

  while (true) {
    if (!isRunning) break
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await withJobMetrics(JOB_NAME, tick)
  }

  logger.info('[email-outbox-worker] Shutting down gracefully', { job: JOB_NAME })
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const result = await withJobLock(JOB_NAME, run)
  if (result === undefined) {
    logger.info('[email-outbox-worker] Another instance is already running; exiting cleanly.', {
      job: JOB_NAME,
    })
  }
}

if (!process.env.VITEST) {
  main().catch((err) => {
    logger.error('[email-outbox-worker] Fatal error:', err, { job: JOB_NAME })
    process.exit(1)
  })
}

// Re-export for account deletion cleanup path.
export { deletePendingOutboxRowsForUser }
