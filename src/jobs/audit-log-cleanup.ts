/**
 * Audit log cleanup poller.
 *
 * Runs continuously in the background, periodically invoking
 * `purgeOldAuditLogs()` to delete audit log entries older than
 * the configured retention period.
 *
 * Configuration (via environment variables):
 *   AUDIT_LOG_CLEANUP_INTERVAL_MS — polling interval in milliseconds (default: 86400000)
 *   AUDIT_LOG_RETENTION_DAYS      — retention period in days (default: 365)
 *
 * Usage:
 *   bun run src/jobs/audit-log-cleanup.ts
 *
 * Graceful shutdown is handled on SIGINT / SIGTERM.
 */
import { purgeOldAuditLogs } from '#/lib/audit-log.server'
import { withJobLock } from '#/lib/job-lock.server'
import { logger } from '#/lib/logger.server'
import { declareJobInterval, withJobMetrics } from '#/lib/with-job-metrics.server'

const INTERVAL_MS = Number.parseInt(process.env.AUDIT_LOG_CLEANUP_INTERVAL_MS ?? '86400000', 10)
const RETENTION_DAYS = Number.parseInt(process.env.AUDIT_LOG_RETENTION_DAYS ?? '365', 10)

const JOB_NAME = 'audit-log-cleanup'

let isRunning = true

async function tick(): Promise<void> {
  const result = await purgeOldAuditLogs(RETENTION_DAYS)
  if (result.deletedCount > 0) {
    logger.info(`[audit-log-cleanup] Deleted ${result.deletedCount} old audit log entry(s)`, {
      job: JOB_NAME,
      deletedCount: result.deletedCount,
    })
  }
}

async function run(): Promise<void> {
  logger.info(
    `[audit-log-cleanup] Started (interval=${INTERVAL_MS}ms, retentionDays=${RETENTION_DAYS})`,
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

  logger.info('[audit-log-cleanup] Shutting down gracefully', { job: JOB_NAME })
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const result = await withJobLock(JOB_NAME, run)
  if (result === undefined) {
    logger.info('[audit-log-cleanup] Another instance is already running; exiting cleanly.', {
      job: JOB_NAME,
    })
  }
}

main().catch((err) => {
  logger.error('[audit-log-cleanup] Fatal error:', err, { job: JOB_NAME })
  process.exit(1)
})
