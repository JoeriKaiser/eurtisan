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

const INTERVAL_MS = Number.parseInt(process.env.INVENTORY_CLEANUP_INTERVAL_MS ?? '60000', 10)

const BATCH_SIZE = Number.parseInt(process.env.INVENTORY_CLEANUP_BATCH_SIZE ?? '100', 10)

let isRunning = true

async function tick(): Promise<void> {
  try {
    const reservationResult = await releaseExpiredReservations(BATCH_SIZE)
    if (reservationResult.releasedCount > 0) {
      console.log(
        `[inventory-cleanup] Released ${reservationResult.releasedCount} expired reservation(s)`,
      )
    }
  } catch (err) {
    console.error('[inventory-cleanup] Error releasing expired reservations:', err)
  }

  try {
    const orderResult = await cancelAbandonedPendingPaymentOrders(BATCH_SIZE)
    if (orderResult.cancelledCount > 0) {
      console.log(`[inventory-cleanup] Cancelled ${orderResult.cancelledCount} abandoned order(s)`)
    }
  } catch (err) {
    console.error('[inventory-cleanup] Error cancelling abandoned orders:', err)
  }
}

async function main(): Promise<void> {
  console.log(`[inventory-cleanup] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE})`)

  // Run immediately on start, then on every interval
  await tick()

  while (true) {
    if (!isRunning) break
    // Intentionally sequential: sleep then tick to maintain a fixed interval.
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await tick()
  }

  console.log('[inventory-cleanup] Shutting down gracefully')
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

main().catch((err) => {
  console.error('[inventory-cleanup] Fatal error:', err)
  process.exit(1)
})
