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
import { getEmailHeaders } from '#/lib/email-headers.server'
import { isEmailEnabledForUser } from '#/lib/email-preferences.server'
import { logEmailEvent } from '#/lib/email-send-log.server'
import { isEmailSuppressed } from '#/lib/email-suppression.server'
import {
  getEmailMaxRetries,
  getEmailOutboxWorkerBatchSize,
  getEmailOutboxWorkerIntervalMs,
} from '#/lib/env.server'
import { logger } from '#/lib/logger.server'
import { emailFailedTotal, emailSentTotal, emailSuppressedSkipsTotal } from '#/lib/metrics.server'

const INTERVAL_MS = getEmailOutboxWorkerIntervalMs()
const BATCH_SIZE = getEmailOutboxWorkerBatchSize()
const MAX_RETRIES = getEmailMaxRetries()
const STUCK_RESET_TICKS = 6 // Reset stuck rows every ~INTERVAL_MS * 6

let isRunning = true
let tickCount = 0

async function sendOutboxRow(row: EmailOutboxRow): Promise<void> {
  const provider = createEmailProvider()

  if (await isEmailSuppressed(row.recipientEmail)) {
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

  const enabled = await isEmailEnabledForUser(row.userId ?? '', row.category)
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

  const headers = await getEmailHeaders(row.recipientEmail, row.template, row.category)

  await markOutboxSending(row.id)

  try {
    const result = await provider.sendTransactional(
      row.recipientEmail,
      row.template,
      row.data as Record<string, unknown>,
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
    try {
      const result = await resetStuckSendingRows(5)
      if (result.reset > 0) {
        logger.info('outbox.worker.reset_stuck', { count: result.reset })
      }
    } catch (err) {
      logger.error('outbox.worker.reset_stuck error', err)
    }
  }

  try {
    await processOutboxBatch(BATCH_SIZE)
  } catch (err) {
    logger.error('outbox.worker.tick error', err)
  }
}

async function main(): Promise<void> {
  console.log(
    `[email-outbox-worker] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE}, maxRetries=${MAX_RETRIES})`,
  )

  // Run immediately on start, then on every interval.
  await tick()

  while (true) {
    if (!isRunning) break
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await tick()
  }

  console.log('[email-outbox-worker] Shutting down gracefully')
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

if (!process.env.VITEST) {
  main().catch((err) => {
    console.error('[email-outbox-worker] Fatal error:', err)
    process.exit(1)
  })
}

// Re-export for account deletion cleanup path.
export { deletePendingOutboxRowsForUser }
