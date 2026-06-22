/**
 * Session cleanup poller.
 *
 * Runs continuously in the background, periodically invoking
 * `cleanupExpiredSessions()` to delete sessions whose `expiresAt`
 * timestamp has passed.
 *
 * Configuration (via environment variables):
 *   SESSION_CLEANUP_INTERVAL_MS — polling interval in milliseconds (default: 60_000)
 *   SESSION_CLEANUP_BATCH_SIZE  — max rows to delete per run (default: 100)
 *
 * Usage:
 *   bun run src/jobs/session-cleanup.ts
 *
 * Graceful shutdown is handled on SIGINT / SIGTERM.
 */
import { withJobLock } from '#/lib/job-lock.server'
import { cleanupExpiredSessions } from '#/lib/session-cleanup.server'

const INTERVAL_MS = Number.parseInt(process.env.SESSION_CLEANUP_INTERVAL_MS ?? '60000', 10)

const BATCH_SIZE = Number.parseInt(process.env.SESSION_CLEANUP_BATCH_SIZE ?? '100', 10)

let isRunning = true

async function tick(): Promise<void> {
  try {
    const result = await cleanupExpiredSessions(BATCH_SIZE)
    if (result.deletedCount > 0) {
      console.log(`[session-cleanup] Deleted ${result.deletedCount} expired session(s)`)
    }
  } catch (err) {
    console.error('[session-cleanup] Error deleting expired sessions:', err)
  }
}

async function run(): Promise<void> {
  console.log(`[session-cleanup] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE})`)

  // Run immediately on start, then on every interval
  await tick()

  while (true) {
    if (!isRunning) break
    // Intentionally sequential: sleep then tick to maintain a fixed interval.
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await tick()
  }

  console.log('[session-cleanup] Shutting down gracefully')
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const result = await withJobLock('session-cleanup', run)
  if (result === undefined) {
    console.log('[session-cleanup] Another instance is already running; exiting cleanly.')
  }
}

main().catch((err) => {
  console.error('[session-cleanup] Fatal error:', err)
  process.exit(1)
})
