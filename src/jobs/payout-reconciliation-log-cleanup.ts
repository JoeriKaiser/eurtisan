/**
 * Payout reconciliation log retention cleanup poller.
 *
 * Runs continuously in the background, periodically deleting
 * payout_reconciliation_log rows older than the configured retention period.
 *
 * Configuration:
 *   PAYOUT_RECONCILIATION_LOG_RETENTION_DAYS      — retention period in days (default: 365, min: 1)
 *   PAYOUT_RECONCILIATION_LOG_CLEANUP_INTERVAL_MS — polling interval (default: 86400000)
 *   PAYOUT_RECONCILIATION_LOG_CLEANUP_BATCH_SIZE  — max rows per run (default: 1000)
 *
 * Usage:
 *   bun run src/jobs/payout-reconciliation-log-cleanup.ts
 *
 * Graceful shutdown is handled on SIGINT / SIGTERM.
 */
import { getPayoutReconciliationLogRetentionDays } from '#/lib/env.server'
import { withJobLock } from '#/lib/job-lock.server'
import { cleanupPayoutReconciliationLog } from '#/lib/payout-reconciliation-log-cleanup.server'

const INTERVAL_MS = Number.parseInt(
  process.env.PAYOUT_RECONCILIATION_LOG_CLEANUP_INTERVAL_MS ?? '86400000',
  10,
)
const BATCH_SIZE = Number.parseInt(
  process.env.PAYOUT_RECONCILIATION_LOG_CLEANUP_BATCH_SIZE ?? '1000',
  10,
)
const RETENTION_DAYS = getPayoutReconciliationLogRetentionDays()

let isRunning = true

async function tick(): Promise<void> {
  const start = Date.now()
  try {
    const result = await cleanupPayoutReconciliationLog(RETENTION_DAYS, BATCH_SIZE)
    const durationMs = Date.now() - start
    console.log(
      JSON.stringify({
        job: 'payout-reconciliation-log-cleanup',
        deleted: result.deleted,
        retentionDays: RETENTION_DAYS,
        durationMs,
        error: null,
      }),
    )
  } catch (err) {
    const durationMs = Date.now() - start
    console.error(
      JSON.stringify({
        job: 'payout-reconciliation-log-cleanup',
        deleted: 0,
        retentionDays: RETENTION_DAYS,
        durationMs,
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
    )
  }
}

async function run(): Promise<void> {
  console.log(
    `[payout-reconciliation-log-cleanup] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE}, retentionDays=${RETENTION_DAYS})`,
  )

  await tick()

  while (true) {
    if (!isRunning) break
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await tick()
  }

  console.log('[payout-reconciliation-log-cleanup] Shutting down gracefully')
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const result = await withJobLock('payout-reconciliation-log-cleanup', run)
  if (result === undefined) {
    console.log(
      '[payout-reconciliation-log-cleanup] Another instance is already running; exiting cleanly.',
    )
  }
}

main().catch((err) => {
  console.error('[payout-reconciliation-log-cleanup] Fatal error:', err)
  process.exit(1)
})
