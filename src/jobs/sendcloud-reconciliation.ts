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
import { getSendcloudReconciliationIntervalMs } from '#/lib/env.server'
import { reconcileSendcloudShipments } from '#/lib/sendcloud-reconciliation.server'

const INTERVAL_MS = getSendcloudReconciliationIntervalMs()

let isRunning = true

async function tick(): Promise<void> {
  try {
    const result = await reconcileSendcloudShipments()
    if (result.checked > 0) {
      console.log(
        `[sendcloud-reconciliation] Checked ${result.checked} shipment(s), updated ${result.updated}, errors ${result.errors}`,
      )
    }
  } catch (err) {
    console.error('[sendcloud-reconciliation] Error reconciling shipments:', err)
  }
}

async function main(): Promise<void> {
  console.log(`[sendcloud-reconciliation] Started (interval=${INTERVAL_MS}ms)`)

  // Run immediately on start, then on every interval
  await tick()

  while (true) {
    if (!isRunning) break
    // Intentionally sequential: sleep then tick to maintain a fixed interval.
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await tick()
  }

  console.log('[sendcloud-reconciliation] Shutting down gracefully')
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

main().catch((err) => {
  console.error('[sendcloud-reconciliation] Fatal error:', err)
  process.exit(1)
})
