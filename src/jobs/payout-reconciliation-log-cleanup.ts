/**
 * Payout reconciliation log retention cleanup poller.
 *
 * Runs continuously in the background, periodically deleting
 * payout_reconciliation_log rows older than the configured retention period.
 *
 * Configuration:
 *   PAYOUT_RECONCILIATION_LOG_RETENTION_DAYS      — retention period in days (default: 365, min: 1)
 *   PAYOUT_RECONCILIATION_LOG_CLEANUP_INTERVAL_MS — polling interval (default: 86400000)
 *   PAYOUT_RECONCILIATION_LOG_CLEANUP_BATCH_SIZE  — max rows per run (default: 1000)
 *
 * Usage:
 *   bun run src/jobs/payout-reconciliation-log-cleanup.ts
 *
 * Graceful shutdown is handled on SIGINT / SIGTERM.
 */
import { getPayoutReconciliationLogRetentionDays } from '#/lib/env.server'
import { withJobLock } from '#/lib/job-lock.server'
import { logger } from '#/lib/logger.server'
import { cleanupPayoutReconciliationLog } from '#/lib/payout-reconciliation-log-cleanup.server'
import { declareJobInterval, withJobMetrics } from '#/lib/with-job-metrics.server'

const INTERVAL_MS = Number.parseInt(
  process.env.PAYOUT_RECONCILIATION_LOG_CLEANUP_INTERVAL_MS ?? '86400000',
  10,
)
const BATCH_SIZE = Number.parseInt(
  process.env.PAYOUT_RECONCILIATION_LOG_CLEANUP_BATCH_SIZE ?? '1000',
  10,
)
const RETENTION_DAYS = getPayoutReconciliationLogRetentionDays()

const JOB_NAME = 'payout-reconciliation-log-cleanup'

let isRunning = true

async function tick(): Promise<void> {
  const result = await cleanupPayoutReconciliationLog(RETENTION_DAYS, BATCH_SIZE)
  if (result.deleted > 0) {
    logger.info(`[payout-reconciliation-log-cleanup] Deleted ${result.deleted} log row(s)`, {
      job: JOB_NAME,
      deleted: result.deleted,
      retentionDays: RETENTION_DAYS,
    })
  }
}

async function run(): Promise<void> {
  logger.info(
    `[payout-reconciliation-log-cleanup] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE}, retentionDays=${RETENTION_DAYS})`,
    {
      job: JOB_NAME,
      intervalMs: INTERVAL_MS,
      batchSize: BATCH_SIZE,
      retentionDays: RETENTION_DAYS,
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

  logger.info('[payout-reconciliation-log-cleanup] Shutting down gracefully', { job: JOB_NAME })
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
      '[payout-reconciliation-log-cleanup] Another instance is already running; exiting cleanly.',
      {
        job: JOB_NAME,
      },
    )
  }
}

main().catch((err) => {
  logger.error('[payout-reconciliation-log-cleanup] Fatal error:', err, { job: JOB_NAME })
  process.exit(1)
})
