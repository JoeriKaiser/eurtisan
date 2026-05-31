/**
 * Verification cleanup poller.
 *
 * Runs continuously in the background, periodically invoking
 * `cleanupExpiredVerifications()` to delete verification tokens whose
 * `expiresAt` timestamp has passed.
 *
 * Configuration (via environment variables):
 *   VERIFICATION_CLEANUP_INTERVAL_MS — polling interval in milliseconds (default: 60_000)
 *   VERIFICATION_CLEANUP_BATCH_SIZE  — max rows to delete per run (default: 100)
 *
 * Usage:
 *   bun run src/jobs/verification-cleanup.ts
 *
 * Graceful shutdown is handled on SIGINT / SIGTERM.
 */
import { cleanupExpiredVerifications } from '#/lib/verification-cleanup.server'

const INTERVAL_MS = Number.parseInt(process.env.VERIFICATION_CLEANUP_INTERVAL_MS ?? '60000', 10)

const BATCH_SIZE = Number.parseInt(process.env.VERIFICATION_CLEANUP_BATCH_SIZE ?? '100', 10)

let isRunning = true

async function tick(): Promise<void> {
  try {
    const result = await cleanupExpiredVerifications(BATCH_SIZE)
    if (result.deletedCount > 0) {
      console.log(`[verification-cleanup] Deleted ${result.deletedCount} expired verification(s)`)
    }
  } catch (err) {
    console.error('[verification-cleanup] Error deleting expired verifications:', err)
  }
}

async function main(): Promise<void> {
  console.log(`[verification-cleanup] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE})`)

  // Run immediately on start, then on every interval
  await tick()

  while (true) {
    if (!isRunning) break
    // Intentionally sequential: sleep then tick to maintain a fixed interval.
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await tick()
  }

  console.log('[verification-cleanup] Shutting down gracefully')
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

main().catch((err) => {
  console.error('[verification-cleanup] Fatal error:', err)
  process.exit(1)
})
