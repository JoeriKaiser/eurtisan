/**
 * Return expiry cleanup poller.
 *
 * Runs continuously in the background, periodically invoking
 * `closeExpiredReturnRequestsQuery()` to transition un-shipped or un-reviewed
 * return requests that have exceeded the return deadline by more than 7 days
 * into the terminal 'closed' status.
 *
 * Configuration (via environment variables):
 *   RETURN_EXPIRY_CLEANUP_INTERVAL_MS: polling interval in milliseconds (default: 86_400_000, daily)
 *   RETURN_EXPIRY_CLEANUP_BATCH_SIZE: max rows to update per run (default: 100)
 *
 * Usage:
 *   bun run src/jobs/return-expiry-cleanup.ts
 *
 * Graceful shutdown is handled on SIGINT / SIGTERM.
 */
import { setTimeout as sleep } from 'node:timers/promises'
import { withJobLock } from '#/lib/job-lock.server'
import { logger } from '#/lib/logger.server'
import { closeExpiredReturnRequestsQuery } from '#/lib/returns/operations.server'
import { declareJobInterval, withJobMetrics } from '#/lib/with-job-metrics.server'

const INTERVAL_MS = Number.parseInt(process.env.RETURN_EXPIRY_CLEANUP_INTERVAL_MS ?? '86400000', 10)

const BATCH_SIZE = Number.parseInt(process.env.RETURN_EXPIRY_CLEANUP_BATCH_SIZE ?? '100', 10)

const JOB_NAME = 'return-expiry-cleanup'

let isRunning = true

export async function tick(): Promise<{ closedCount: number }> {
  const closedCount = await closeExpiredReturnRequestsQuery(BATCH_SIZE)
  if (closedCount > 0) {
    logger.info(`[${JOB_NAME}] Closed ${closedCount} expired return request(s)`, {
      job: JOB_NAME,
      closedCount,
    })
  }
  return { closedCount }
}

async function run(): Promise<void> {
  logger.info(`[${JOB_NAME}] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE})`, {
    job: JOB_NAME,
    intervalMs: INTERVAL_MS,
    batchSize: BATCH_SIZE,
  })

  declareJobInterval(JOB_NAME, INTERVAL_MS)

  await withJobMetrics(JOB_NAME, async () => {
    await tick()
  })

  while (true) {
    if (!isRunning) break
    await sleep(INTERVAL_MS)
    if (!isRunning) break
    await withJobMetrics(JOB_NAME, async () => {
      await tick()
    })
  }

  logger.info(`[${JOB_NAME}] Shutting down gracefully`, { job: JOB_NAME })
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const result = await withJobLock(JOB_NAME, run)
  if (result === undefined) {
    logger.info(`[${JOB_NAME}] Another instance is already running; exiting cleanly.`, {
      job: JOB_NAME,
    })
  }
}

if (!process.env.VITEST) {
  main().catch((err) => {
    logger.error(`[${JOB_NAME}] Fatal error:`, err, { job: JOB_NAME })
    process.exit(1)
  })
}
