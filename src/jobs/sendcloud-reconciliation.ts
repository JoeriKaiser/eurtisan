/**
 * Sendcloud shipment reconciliation poller.
 *
 * Runs continuously in the background, periodically polling Sendcloud for the
 * status of shipped orders. If a webhook was missed and a parcel is reported as
 * delivered, the corresponding shop order is marked as delivered.
 *
 * Configuration (via environment variables):
 *   SENDCLOUD_RECONCILIATION_INTERVAL_MS — polling interval in milliseconds (default: 21_600_000 = 6h)
 *
 * Usage:
 *   bun run src/jobs/sendcloud-reconciliation.ts
 *
 * Graceful shutdown is handled on SIGINT / SIGTERM.
 */
import {
  assertMockPayoutsNotProduction,
  getSendcloudReconciliationIntervalMs,
} from '#/lib/env.server'
import { withJobLock } from '#/lib/job-lock.server'
import { logger } from '#/lib/logger.server'
import { reconcileSendcloudShipments } from '#/lib/sendcloud-reconciliation.server'
import { declareJobInterval, withJobMetrics } from '#/lib/with-job-metrics.server'

assertMockPayoutsNotProduction()

const INTERVAL_MS = getSendcloudReconciliationIntervalMs()

const JOB_NAME = 'sendcloud-reconciliation'

let isRunning = true

async function tick(): Promise<void> {
  const result = await reconcileSendcloudShipments()
  if (result.checked > 0) {
    logger.info(
      `[sendcloud-reconciliation] Checked ${result.checked} shipment(s), updated ${result.updated}, errors ${result.errors}`,
      {
        job: JOB_NAME,
        checked: result.checked,
        updated: result.updated,
        errors: result.errors,
      },
    )
  }
}

async function run(): Promise<void> {
  logger.info(`[sendcloud-reconciliation] Started (interval=${INTERVAL_MS}ms)`, {
    job: JOB_NAME,
    intervalMs: INTERVAL_MS,
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

  logger.info('[sendcloud-reconciliation] Shutting down gracefully', { job: JOB_NAME })
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
      '[sendcloud-reconciliation] Another instance is already running; exiting cleanly.',
      {
        job: JOB_NAME,
      },
    )
  }
}

main().catch((err) => {
  logger.error('[sendcloud-reconciliation] Fatal error:', err, { job: JOB_NAME })
  process.exit(1)
})
