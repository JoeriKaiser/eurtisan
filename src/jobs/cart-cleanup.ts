/**
 * Cart cleanup poller.
 *
 * Runs continuously in the background, periodically invoking
 * `clearExpiredCarts()` to delete carts whose `expiresAt`
 * timestamp has passed.
 *
 * Configuration (via environment variables):
 *   CART_CLEANUP_INTERVAL_MS — polling interval in milliseconds (default: 60_000)
 *   CART_CLEANUP_BATCH_SIZE  — max rows to delete per run (default: 100)
 *
 * Usage:
 *   bun run src/jobs/cart-cleanup.ts
 *
 * Graceful shutdown is handled on SIGINT / SIGTERM.
 */
import { clearExpiredCarts } from '#/lib/cart.server'

const INTERVAL_MS = Number.parseInt(process.env.CART_CLEANUP_INTERVAL_MS ?? '60000', 10)

const BATCH_SIZE = Number.parseInt(process.env.CART_CLEANUP_BATCH_SIZE ?? '100', 10)

let isRunning = true

async function tick(): Promise<void> {
  try {
    const result = await clearExpiredCarts(BATCH_SIZE)
    if (result.deletedCount > 0) {
      console.log(`[cart-cleanup] Deleted ${result.deletedCount} expired cart(s)`)
    }
  } catch (err) {
    console.error('[cart-cleanup] Error deleting expired carts:', err)
  }
}

async function main(): Promise<void> {
  console.log(`[cart-cleanup] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE})`)

  // Run immediately on start, then on every interval
  await tick()

  while (true) {
    if (!isRunning) break
    // Intentionally sequential: sleep then tick to maintain a fixed interval.
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await tick()
  }

  console.log('[cart-cleanup] Shutting down gracefully')
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

main().catch((err) => {
  console.error('[cart-cleanup] Fatal error:', err)
  process.exit(1)
})
