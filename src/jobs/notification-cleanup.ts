/**
 * Notification retention poller.
 *
 * Deletes **read** notifications older than the configured retention period.
 * Unread ones are never touched: an unread notification is information the
 * recipient has not yet received, and a chargeback alert or a statement of
 * reasons must not disappear because time passed. See
 * `lib/notifications/retention.server.ts`.
 *
 * Configuration (via environment variables):
 *   NOTIFICATION_CLEANUP_INTERVAL_MS — polling interval in milliseconds (default: 86400000)
 *   NOTIFICATION_RETENTION_DAYS      — retention period in days (default: 365)
 *
 * Usage:
 *   bun run src/jobs/notification-cleanup.ts
 *
 * Graceful shutdown is handled on SIGINT / SIGTERM.
 */
import { withJobLock } from '#/lib/job-lock.server'
import { logger } from '#/lib/logger.server'
import { purgeOldNotifications } from '#/lib/notifications/retention.server'
import { declareJobInterval, withJobMetrics } from '#/lib/with-job-metrics.server'

const INTERVAL_MS = Number.parseInt(process.env.NOTIFICATION_CLEANUP_INTERVAL_MS ?? '86400000', 10)
const RETENTION_DAYS = Number.parseInt(process.env.NOTIFICATION_RETENTION_DAYS ?? '365', 10)

const JOB_NAME = 'notification-cleanup'

let isRunning = true

async function tick(): Promise<void> {
  const result = await purgeOldNotifications(RETENTION_DAYS)
  if (result.deleted > 0) {
    logger.info(`[notification-cleanup] Deleted ${result.deleted} read notification(s)`, {
      job: JOB_NAME,
      deletedCount: result.deleted,
    })
  }
}

async function run(): Promise<void> {
  logger.info(
    `[notification-cleanup] Started (interval=${INTERVAL_MS}ms, retentionDays=${RETENTION_DAYS})`,
    {
      job: JOB_NAME,
      intervalMs: INTERVAL_MS,
      retentionDays: RETENTION_DAYS,
    },
  )

  // Declares the cadence EurtisanJobStale measures this job against.
  declareJobInterval(JOB_NAME, INTERVAL_MS)

  // Run immediately on start, then on every interval.
  await withJobMetrics(JOB_NAME, tick)

  while (true) {
    if (!isRunning) break
    // Intentionally sequential: sleep then tick to maintain a fixed interval.
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await withJobMetrics(JOB_NAME, tick)
  }

  logger.info('[notification-cleanup] Shutting down gracefully', { job: JOB_NAME })
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const result = await withJobLock(JOB_NAME, run)
  if (result === undefined) {
    logger.info('[notification-cleanup] Another instance is already running; exiting cleanly.', {
      job: JOB_NAME,
    })
  }
}

main().catch((err) => {
  logger.error('[notification-cleanup] Fatal error:', err, { job: JOB_NAME })
  process.exit(1)
})
