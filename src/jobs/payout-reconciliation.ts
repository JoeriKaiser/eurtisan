/**
 * Payout reconciliation poller.
 *
 * Runs continuously in the background, periodically reconciling payout records
 * against Mollie delayed-routing routes and refunds. Marks payouts as reversed
 * when the underlying route has disappeared or a refund has been created, and
 * alerts on pending payouts approaching the 90-day routing window.
 *
 * Configuration (via environment variables):
 *   PAYOUT_RECONCILIATION_INTERVAL_MS — polling interval in milliseconds (default: 21_600_000 = 6h)
 *
 * Usage:
 *   bun run src/jobs/payout-reconciliation.ts
 *
 * Graceful shutdown is handled on SIGINT / SIGTERM.
 */
import { assertMockPayoutsNotProduction, getPayoutReconciliationIntervalMs } from '#/lib/env.server'
import { withJobLock } from '#/lib/job-lock.server'
import { logger } from '#/lib/logger.server'
import {
  alertOnStalePendingPayouts,
  reconcilePayouts,
  releaseHeldPayouts,
} from '#/lib/payout-reconciliation.server'
import { withJobMetrics } from '#/lib/with-job-metrics.server'

assertMockPayoutsNotProduction()

const INTERVAL_MS = getPayoutReconciliationIntervalMs()

const JOB_NAME = 'payout-reconciliation'

let isRunning = true

async function tick(): Promise<void> {
  const result = await reconcilePayouts()
  if (result.checked > 0) {
    logger.info(
      `[payout-reconciliation] Checked ${result.checked} payout(s), reversed ${result.reversed}, errors ${result.errors}`,
      {
        job: JOB_NAME,
        checked: result.checked,
        reversed: result.reversed,
        errors: result.errors,
      },
    )
  }

  const staleCount = await alertOnStalePendingPayouts()
  if (staleCount > 0) {
    logger.info(`[payout-reconciliation] Alerted on ${staleCount} stale pending payout(s)`, {
      job: JOB_NAME,
      staleCount,
    })
  }

  const releaseResult = await releaseHeldPayouts()
  if (releaseResult.checked > 0) {
    logger.info(
      `[payout-reconciliation] Released ${releaseResult.released} of ${releaseResult.checked} held payout(s), errors ${releaseResult.errors}`,
      {
        job: JOB_NAME,
        checked: releaseResult.checked,
        released: releaseResult.released,
        errors: releaseResult.errors,
      },
    )
  }
}

async function run(): Promise<void> {
  logger.info(`[payout-reconciliation] Started (interval=${INTERVAL_MS}ms)`, {
    job: JOB_NAME,
    intervalMs: INTERVAL_MS,
  })

  // Run immediately on start, then on every interval.
  await withJobMetrics(JOB_NAME, tick)

  while (true) {
    if (!isRunning) break
    // Intentionally sequential: sleep then tick to maintain a fixed interval.
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await withJobMetrics(JOB_NAME, tick)
  }

  logger.info('[payout-reconciliation] Shutting down gracefully', { job: JOB_NAME })
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const result = await withJobLock(JOB_NAME, run)
  if (result === undefined) {
    logger.info('[payout-reconciliation] Another instance is already running; exiting cleanly.', {
      job: JOB_NAME,
    })
  }
}

main().catch((err) => {
  logger.error('[payout-reconciliation] Fatal error:', err, { job: JOB_NAME })
  process.exit(1)
})
