/**
 * Verification cleanup poller.
 *
 * Runs continuously in the background, periodically invoking
 * `cleanupExpiredVerifications()` to delete verification tokens whose
 * `expiresAt` timestamp has passed.
 *
 * Configuration (via environment variables):
 *   VERIFICATION_CLEANUP_INTERVAL_MS — polling interval in milliseconds (default: 60_000)
 *   VERIFICATION_CLEANUP_BATCH_SIZE  — max rows to delete per run (default: 100)
 *
 * Usage:
 *   bun run src/jobs/verification-cleanup.ts
 *
 * Graceful shutdown is handled on SIGINT / SIGTERM.
 */
import { withJobLock } from '#/lib/job-lock.server'
import { logger } from '#/lib/logger.server'
import { cleanupExpiredVerifications } from '#/lib/verification-cleanup.server'
import { withJobMetrics } from '#/lib/with-job-metrics.server'

const INTERVAL_MS = Number.parseInt(process.env.VERIFICATION_CLEANUP_INTERVAL_MS ?? '60000', 10)

const BATCH_SIZE = Number.parseInt(process.env.VERIFICATION_CLEANUP_BATCH_SIZE ?? '100', 10)

const JOB_NAME = 'verification-cleanup'

let isRunning = true

async function tick(): Promise<void> {
  const result = await cleanupExpiredVerifications(BATCH_SIZE)
  if (result.deletedCount > 0) {
    logger.info(`[verification-cleanup] Deleted ${result.deletedCount} expired verification(s)`, {
      job: JOB_NAME,
      deletedCount: result.deletedCount,
    })
  }
}

async function run(): Promise<void> {
  logger.info(
    `[verification-cleanup] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE})`,
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
    // Intentionally sequential: sleep then tick to maintain a fixed interval.
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await withJobMetrics(JOB_NAME, tick)
  }

  logger.info('[verification-cleanup] Shutting down gracefully', { job: JOB_NAME })
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const result = await withJobLock(JOB_NAME, run)
  if (result === undefined) {
    logger.info('[verification-cleanup] Another instance is already running; exiting cleanly.', {
      job: JOB_NAME,
    })
  }
}

main().catch((err) => {
  logger.error('[verification-cleanup] Fatal error:', err, { job: JOB_NAME })
  process.exit(1)
})
