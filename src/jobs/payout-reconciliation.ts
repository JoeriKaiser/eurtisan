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
import { alertOnStalePendingPayouts, reconcilePayouts } from '#/lib/payout-reconciliation.server'
import { getPayoutReconciliationIntervalMs } from '#/lib/env.server'

const INTERVAL_MS = getPayoutReconciliationIntervalMs()

let isRunning = true

async function tick(): Promise<void> {
  try {
    const result = await reconcilePayouts()
    if (result.checked > 0) {
      console.log(
        `[payout-reconciliation] Checked ${result.checked} payout(s), reversed ${result.reversed}, errors ${result.errors}`,
      )
    }
  } catch (err) {
    console.error('[payout-reconciliation] Error reconciling payouts:', err)
  }

  try {
    const staleCount = await alertOnStalePendingPayouts()
    if (staleCount > 0) {
      console.log(`[payout-reconciliation] Alerted on ${staleCount} stale pending payout(s)`)
    }
  } catch (err) {
    console.error('[payout-reconciliation] Error checking stale payouts:', err)
  }
}

async function main(): Promise<void> {
  console.log(`[payout-reconciliation] Started (interval=${INTERVAL_MS}ms)`)

  // Run immediately on start, then on every interval
  await tick()

  while (true) {
    if (!isRunning) break
    // Intentionally sequential: sleep then tick to maintain a fixed interval.
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await tick()
  }

  console.log('[payout-reconciliation] Shutting down gracefully')
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

main().catch((err) => {
  console.error('[payout-reconciliation] Fatal error:', err)
  process.exit(1)
})
