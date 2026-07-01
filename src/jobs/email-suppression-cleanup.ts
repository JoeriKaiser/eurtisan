/**
 * Expired email suppression cleanup poller.
 *
 * Runs continuously in the background, periodically invoking
 * `cleanupExpiredSuppressions()` to delete soft-bounce suppressions whose
 * `expiresAt` timestamp has passed.
 *
 * Configuration:
 *   EMAIL_SUPPRESSION_CLEANUP_INTERVAL_MS — polling interval (default: 86400000)
 *   EMAIL_SUPPRESSION_CLEANUP_BATCH_SIZE  — max rows to delete per run (default: 1000)
 *
 * Usage:
 *   bun run src/jobs/email-suppression-cleanup.ts
 *
 * Graceful shutdown is handled on SIGINT / SIGTERM.
 */
import { withJobLock } from '#/lib/job-lock.server'
import { cleanupExpiredSuppressions } from '#/lib/email-suppression-cleanup.server'
import { logger } from '#/lib/logger.server'
import { withJobMetrics } from '#/lib/with-job-metrics.server'

const INTERVAL_MS = Number.parseInt(
  process.env.EMAIL_SUPPRESSION_CLEANUP_INTERVAL_MS ?? '86400000',
  10,
)
const BATCH_SIZE = Number.parseInt(process.env.EMAIL_SUPPRESSION_CLEANUP_BATCH_SIZE ?? '1000', 10)

const JOB_NAME = 'email-suppression-cleanup'

let isRunning = true

async function tick(): Promise<void> {
  const result = await cleanupExpiredSuppressions(BATCH_SIZE)
  if (result.deleted > 0) {
    logger.info(`[email-suppression-cleanup] Deleted ${result.deleted} expired suppression(s)`, {
      job: JOB_NAME,
      deleted: result.deleted,
    })
  }
}

async function run(): Promise<void> {
  logger.info(
    `[email-suppression-cleanup] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE})`,
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

  logger.info('[email-suppression-cleanup] Shutting down gracefully', { job: JOB_NAME })
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
      '[email-suppression-cleanup] Another instance is already running; exiting cleanly.',
      {
        job: JOB_NAME,
      },
    )
  }
}

main().catch((err) => {
  logger.error('[email-suppression-cleanup] Fatal error:', err, { job: JOB_NAME })
  process.exit(1)
})
