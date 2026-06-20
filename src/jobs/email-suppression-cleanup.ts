/**
 * Expired email suppression cleanup poller.
 *
 * Runs continuously in the background, periodically invoking
 * `cleanupExpiredSuppressions()` to delete soft-bounce suppressions whose
 * `expiresAt` timestamp has passed.
 *
 * Configuration:
 *   EMAIL_SUPPRESSION_CLEANUP_INTERVAL_MS — polling interval (default: 86400000)
 *   EMAIL_SUPPRESSION_CLEANUP_BATCH_SIZE  — max rows to delete per run (default: 1000)
 *
 * Usage:
 *   bun run src/jobs/email-suppression-cleanup.ts
 *
 * Graceful shutdown is handled on SIGINT / SIGTERM.
 */
import { cleanupExpiredSuppressions } from '#/lib/email-suppression-cleanup.server'

const INTERVAL_MS = Number.parseInt(
  process.env.EMAIL_SUPPRESSION_CLEANUP_INTERVAL_MS ?? '86400000',
  10,
)
const BATCH_SIZE = Number.parseInt(process.env.EMAIL_SUPPRESSION_CLEANUP_BATCH_SIZE ?? '1000', 10)

let isRunning = true

async function tick(): Promise<void> {
  try {
    const result = await cleanupExpiredSuppressions(BATCH_SIZE)
    if (result.deleted > 0) {
      console.log(`[email-suppression-cleanup] Deleted ${result.deleted} expired suppression(s)`)
    }
  } catch (err) {
    console.error('[email-suppression-cleanup] Error deleting expired suppressions:', err)
  }
}

async function main(): Promise<void> {
  console.log(
    `[email-suppression-cleanup] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE})`,
  )

  await tick()

  while (true) {
    if (!isRunning) break
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await tick()
  }

  console.log('[email-suppression-cleanup] Shutting down gracefully')
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

main().catch((err) => {
  console.error('[email-suppression-cleanup] Fatal error:', err)
  process.exit(1)
})
