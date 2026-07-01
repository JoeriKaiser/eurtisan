/**
 * Email retention cleanup poller.
 *
 * Runs continuously in the background, periodically deleting terminal outbox
 * rows, old send log rows, and stale Brevo webhook events.
 *
 * Configuration:
 *   EMAIL_RETENTION_CLEANUP_INTERVAL_MS — polling interval (default: 86400000)
 *   EMAIL_RETENTION_CLEANUP_BATCH_SIZE  — max rows per table per run (default: 1000)
 *
 * Usage:
 *   bun run src/jobs/email-retention-cleanup.ts
 */
import {
  cleanupBrevoWebhookEvents,
  cleanupEmailOutbox,
  cleanupEmailSendLog,
} from '#/lib/email-retention-cleanup.server'
import { withJobLock } from '#/lib/job-lock.server'
import { logger } from '#/lib/logger.server'
import { withJobMetrics } from '#/lib/with-job-metrics.server'

const INTERVAL_MS = Number.parseInt(
  process.env.EMAIL_RETENTION_CLEANUP_INTERVAL_MS ?? '86400000',
  10,
)
const BATCH_SIZE = Number.parseInt(process.env.EMAIL_RETENTION_CLEANUP_BATCH_SIZE ?? '1000', 10)

const JOB_NAME = 'email-retention-cleanup'

let isRunning = true

async function tick(): Promise<void> {
  const [outbox, sendLog, webhookEvents] = await Promise.all([
    cleanupEmailOutbox(BATCH_SIZE),
    cleanupEmailSendLog(BATCH_SIZE),
    cleanupBrevoWebhookEvents(BATCH_SIZE),
  ])

  if (outbox.deleted > 0 || sendLog.deleted > 0 || webhookEvents.deleted > 0) {
    logger.info(
      `[email-retention-cleanup] Deleted outbox=${outbox.deleted}, send_log=${sendLog.deleted}, brevo_webhook_event=${webhookEvents.deleted}`,
      {
        job: JOB_NAME,
        outboxDeleted: outbox.deleted,
        sendLogDeleted: sendLog.deleted,
        brevoWebhookEventsDeleted: webhookEvents.deleted,
      },
    )
  }
}

async function run(): Promise<void> {
  logger.info(
    `[email-retention-cleanup] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE})`,
    {
      job: JOB_NAME,
      intervalMs: INTERVAL_MS,
      batchSize: BATCH_SIZE,
    },
  )

  // Run immediately on start, then on every interval.
  await withJobMetrics(JOB_NAME, tick)

  while (true) {
    if (!isRunning) break
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await withJobMetrics(JOB_NAME, tick)
  }

  logger.info('[email-retention-cleanup] Shutting down gracefully', { job: JOB_NAME })
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const result = await withJobLock(JOB_NAME, run)
  if (result === undefined) {
    logger.info('[email-retention-cleanup] Another instance is already running; exiting cleanly.', {
      job: JOB_NAME,
    })
  }
}

main().catch((err) => {
  logger.error('[email-retention-cleanup] Fatal error:', err, { job: JOB_NAME })
  process.exit(1)
})
