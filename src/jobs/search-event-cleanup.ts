/**
 * Search telemetry cleanup poller.
 *
 * Runs continuously in the background, periodically invoking
 * `purgeOldSearchEvents()` to delete search events older than the configured
 * retention period. Search queries are user-typed free text and can contain
 * personal data, so they are not retained indefinitely.
 *
 * Configuration (via environment variables):
 *   SEARCH_EVENT_CLEANUP_INTERVAL_MS — polling interval in milliseconds (default: 86400000)
 *   SEARCH_EVENT_RETENTION_DAYS      — retention period in days (default: 180)
 *
 * Usage:
 *   bun run src/jobs/search-event-cleanup.ts
 *
 * Graceful shutdown is handled on SIGINT / SIGTERM.
 */
import { withJobLock } from '#/lib/job-lock.server'
import { logger } from '#/lib/logger.server'
import { purgeOldSearchEvents } from '#/lib/search/analytics.server'
import { declareJobInterval, withJobMetrics } from '#/lib/with-job-metrics.server'

const INTERVAL_MS = Number.parseInt(process.env.SEARCH_EVENT_CLEANUP_INTERVAL_MS ?? '86400000', 10)
const RETENTION_DAYS = Number.parseInt(process.env.SEARCH_EVENT_RETENTION_DAYS ?? '180', 10)

const JOB_NAME = 'search-event-cleanup'

let isRunning = true

async function tick(): Promise<void> {
  const result = await purgeOldSearchEvents(RETENTION_DAYS)
  if (result.deleted > 0) {
    logger.info(`[search-event-cleanup] Deleted ${result.deleted} old search event(s)`, {
      job: JOB_NAME,
      deletedCount: result.deleted,
    })
  }
}

async function run(): Promise<void> {
  logger.info(
    `[search-event-cleanup] Started (interval=${INTERVAL_MS}ms, retentionDays=${RETENTION_DAYS})`,
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

  logger.info('[search-event-cleanup] Shutting down gracefully', { job: JOB_NAME })
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const result = await withJobLock(JOB_NAME, run)
  if (result === undefined) {
    logger.info('[search-event-cleanup] Another instance is already running; exiting cleanly.', {
      job: JOB_NAME,
    })
  }
}

main().catch((err) => {
  logger.error('[search-event-cleanup] Fatal error:', err, { job: JOB_NAME })
  process.exit(1)
})
