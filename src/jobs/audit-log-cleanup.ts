/**
 * Audit log cleanup poller.
 *
 * Runs continuously in the background, periodically invoking
 * `purgeOldAuditLogs()` to delete audit log entries older than
 * the configured retention period.
 *
 * Configuration (via environment variables):
 *   AUDIT_LOG_CLEANUP_INTERVAL_MS — polling interval in milliseconds (default: 86400000)
 *   AUDIT_LOG_RETENTION_DAYS      — retention period in days (default: 365)
 *
 * Usage:
 *   bun run src/jobs/audit-log-cleanup.ts
 *
 * Graceful shutdown is handled on SIGINT / SIGTERM.
 */
import { purgeOldAuditLogs } from '#/lib/audit-log.server'
import { withJobLock } from '#/lib/job-lock.server'

const INTERVAL_MS = Number.parseInt(process.env.AUDIT_LOG_CLEANUP_INTERVAL_MS ?? '86400000', 10)
const RETENTION_DAYS = Number.parseInt(process.env.AUDIT_LOG_RETENTION_DAYS ?? '365', 10)

let isRunning = true

async function tick(): Promise<void> {
  try {
    const result = await purgeOldAuditLogs(RETENTION_DAYS)
    if (result.deletedCount > 0) {
      console.log(`[audit-log-cleanup] Deleted ${result.deletedCount} old audit log entry(s)`)
    }
  } catch (err) {
    console.error('[audit-log-cleanup] Error purging old audit logs:', err)
  }
}

async function run(): Promise<void> {
  console.log(
    `[audit-log-cleanup] Started (interval=${INTERVAL_MS}ms, retentionDays=${RETENTION_DAYS})`,
  )

  // Run immediately on start, then on every interval
  await tick()

  while (true) {
    if (!isRunning) break
    // Intentionally sequential: sleep then tick to maintain a fixed interval.
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await tick()
  }

  console.log('[audit-log-cleanup] Shutting down gracefully')
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const result = await withJobLock('audit-log-cleanup', run)
  if (result === undefined) {
    console.log('[audit-log-cleanup] Another instance is already running; exiting cleanly.')
  }
}

main().catch((err) => {
  console.error('[audit-log-cleanup] Fatal error:', err)
  process.exit(1)
})
