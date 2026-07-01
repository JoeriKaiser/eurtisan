/**
 * Inventory reservation cleanup poller.
 *
 * Runs continuously in the background, periodically invoking
 * `releaseExpiredReservations()` to delete inventory locks whose
 * `expiresAt` timestamp has passed, and `cancelAbandonedPendingPaymentOrders()`
 * to cancel stale `pending_payment` orders and release their stock.
 *
 * Configuration (via environment variables):
 *   INVENTORY_CLEANUP_INTERVAL_MS — polling interval in milliseconds (default: 60_000)
 *   INVENTORY_CLEANUP_BATCH_SIZE  — max rows to delete per run (default: 100)
 *
 * Usage:
 *   bun run src/jobs/inventory-cleanup.ts
 *
 * Graceful shutdown is handled on SIGINT / SIGTERM.
 */
import {
  cancelAbandonedPendingPaymentOrders,
  releaseExpiredReservations,
} from '#/lib/inventory.server'
import { withJobLock } from '#/lib/job-lock.server'
import { logger } from '#/lib/logger.server'
import { withJobMetrics } from '#/lib/with-job-metrics.server'

const INTERVAL_MS = Number.parseInt(process.env.INVENTORY_CLEANUP_INTERVAL_MS ?? '60000', 10)

const BATCH_SIZE = Number.parseInt(process.env.INVENTORY_CLEANUP_BATCH_SIZE ?? '100', 10)

const JOB_NAME = 'inventory-cleanup'

let isRunning = true

async function tick(): Promise<void> {
  const reservationResult = await releaseExpiredReservations(BATCH_SIZE)
  if (reservationResult.releasedCount > 0) {
    logger.info(
      `[inventory-cleanup] Released ${reservationResult.releasedCount} expired reservation(s)`,
      {
        job: JOB_NAME,
        releasedCount: reservationResult.releasedCount,
      },
    )
  }

  const orderResult = await cancelAbandonedPendingPaymentOrders(BATCH_SIZE)
  if (orderResult.cancelledCount > 0) {
    logger.info(`[inventory-cleanup] Cancelled ${orderResult.cancelledCount} abandoned order(s)`, {
      job: JOB_NAME,
      cancelledCount: orderResult.cancelledCount,
    })
  }
}

async function run(): Promise<void> {
  logger.info(`[inventory-cleanup] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE})`, {
    job: JOB_NAME,
    intervalMs: INTERVAL_MS,
    batchSize: BATCH_SIZE,
  })

  // Run immediately on start, then on every interval.
  await withJobMetrics(JOB_NAME, tick)

  while (true) {
    if (!isRunning) break
    // Intentionally sequential: sleep then tick to maintain a fixed interval.
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await withJobMetrics(JOB_NAME, tick)
  }

  logger.info('[inventory-cleanup] Shutting down gracefully', { job: JOB_NAME })
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const result = await withJobLock(JOB_NAME, run)
  if (result === undefined) {
    logger.info('[inventory-cleanup] Another instance is already running; exiting cleanly.', {
      job: JOB_NAME,
    })
  }
}

main().catch((err) => {
  logger.error('[inventory-cleanup] Fatal error:', err, { job: JOB_NAME })
  process.exit(1)
})
