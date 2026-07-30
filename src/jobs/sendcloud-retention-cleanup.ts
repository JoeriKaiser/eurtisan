/**
 * Sendcloud webhook event retention cleanup poller.
 *
 * Runs continuously in the background, periodically deleting Sendcloud webhook
 * event rows older than the configured retention period.
 *
 * Configuration:
 *   SENDCLOUD_WEBHOOK_RETENTION_DAYS        — retention period in days (default: 30, min: 1)
 *   SENDCLOUD_WEBHOOK_CLEANUP_INTERVAL_MS   — polling interval (default: 86400000)
 *   SENDCLOUD_WEBHOOK_CLEANUP_BATCH_SIZE    — max rows per run (default: 1000)
 *
 * Usage:
 *   bun run src/jobs/sendcloud-retention-cleanup.ts
 */
import { getSendcloudWebhookRetentionDays } from '#/lib/env.server'
import { withJobLock } from '#/lib/job-lock.server'
import { logger } from '#/lib/logger.server'
import { cleanupSendcloudWebhookEvents } from '#/lib/sendcloud-retention-cleanup.server'
import { declareJobInterval, withJobMetrics } from '#/lib/with-job-metrics.server'

const INTERVAL_MS = Number.parseInt(
  process.env.SENDCLOUD_WEBHOOK_CLEANUP_INTERVAL_MS ?? '86400000',
  10,
)
const BATCH_SIZE = Number.parseInt(process.env.SENDCLOUD_WEBHOOK_CLEANUP_BATCH_SIZE ?? '1000', 10)

const JOB_NAME = 'sendcloud-retention-cleanup'

let isRunning = true

async function tick(): Promise<void> {
  const result = await cleanupSendcloudWebhookEvents(BATCH_SIZE)
  if (result.deleted > 0) {
    logger.info(`[sendcloud-retention-cleanup] Deleted ${result.deleted} webhook event(s)`, {
      job: JOB_NAME,
      deleted: result.deleted,
      retentionDays: getSendcloudWebhookRetentionDays(),
    })
  }
}

async function run(): Promise<void> {
  logger.info(
    `[sendcloud-retention-cleanup] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE}, retentionDays=${getSendcloudWebhookRetentionDays()})`,
    {
      job: JOB_NAME,
      intervalMs: INTERVAL_MS,
      batchSize: BATCH_SIZE,
      retentionDays: getSendcloudWebhookRetentionDays(),
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

  logger.info('[sendcloud-retention-cleanup] Shutting down gracefully', { job: JOB_NAME })
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const result = await withJobLock(JOB_NAME, run)
  if (result === undefined) {
    logger.info(
      '[sendcloud-retention-cleanup] Another instance is already running; exiting cleanly.',
      {
        job: JOB_NAME,
      },
    )
  }
}

main().catch((err) => {
  logger.error('[sendcloud-retention-cleanup] Fatal error:', err, { job: JOB_NAME })
  process.exit(1)
})
