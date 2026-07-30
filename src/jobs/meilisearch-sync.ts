/**
 * Meilisearch Sync Poller.
 *
 * Runs continuously in the background, periodically processing pending/failed items in the outbox queue.
 *
 * Configuration (via environment variables):
 *   MEILISEARCH_SYNC_INTERVAL_MS — polling interval in milliseconds (default: 5000)
 *   MEILISEARCH_SYNC_BATCH_SIZE  — max rows to process per tick (default: 50)
 *
 * Usage:
 *   bun run src/jobs/meilisearch-sync.ts
 */
import { withJobLock } from '#/lib/job-lock.server'
import { logger } from '#/lib/logger.server'
import { processMeilisearchSyncQueue } from '#/lib/meilisearch-products.server'
import { declareJobInterval, withJobMetrics } from '#/lib/with-job-metrics.server'

const INTERVAL_MS = Number.parseInt(process.env.MEILISEARCH_SYNC_INTERVAL_MS ?? '5000', 10)
const BATCH_SIZE = Number.parseInt(process.env.MEILISEARCH_SYNC_BATCH_SIZE ?? '50', 10)

const JOB_NAME = 'meilisearch-sync'

let isRunning = true

async function tick(): Promise<void> {
  const result = await processMeilisearchSyncQueue(BATCH_SIZE)
  if (result.processedCount > 0) {
    logger.info(`[meilisearch-sync] Processed ${result.processedCount} sync queue items`, {
      job: JOB_NAME,
      processedCount: result.processedCount,
    })
  }
}

async function run(): Promise<void> {
  logger.info(`[meilisearch-sync] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE})`, {
    job: JOB_NAME,
    intervalMs: INTERVAL_MS,
    batchSize: BATCH_SIZE,
  })

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

  logger.info('[meilisearch-sync] Shutting down gracefully', { job: JOB_NAME })
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const result = await withJobLock(JOB_NAME, run)
  if (result === undefined) {
    logger.info('[meilisearch-sync] Another instance is already running; exiting cleanly.', {
      job: JOB_NAME,
    })
  }
}

main().catch((err) => {
  logger.error('[meilisearch-sync] Fatal error:', err, { job: JOB_NAME })
  process.exit(1)
})
