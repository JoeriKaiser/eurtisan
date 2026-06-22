/**
 * Sendcloud webhook event retention cleanup poller.
 *
 * Runs continuously in the background, periodically deleting Sendcloud webhook
 * event rows older than the configured retention period.
 *
 * Configuration:
 *   SENDCLOUD_WEBHOOK_RETENTION_DAYS        — retention period in days (default: 30, min: 1)
 *   SENDCLOUD_WEBHOOK_CLEANUP_INTERVAL_MS   — polling interval (default: 86400000)
 *   SENDCLOUD_WEBHOOK_CLEANUP_BATCH_SIZE    — max rows per run (default: 1000)
 *
 * Usage:
 *   bun run src/jobs/sendcloud-retention-cleanup.ts
 */
import { getSendcloudWebhookRetentionDays } from '#/lib/env.server'
import { withJobLock } from '#/lib/job-lock.server'
import { cleanupSendcloudWebhookEvents } from '#/lib/sendcloud-retention-cleanup.server'

const INTERVAL_MS = Number.parseInt(
  process.env.SENDCLOUD_WEBHOOK_CLEANUP_INTERVAL_MS ?? '86400000',
  10,
)
const BATCH_SIZE = Number.parseInt(process.env.SENDCLOUD_WEBHOOK_CLEANUP_BATCH_SIZE ?? '1000', 10)

let isRunning = true

async function tick(): Promise<void> {
  const start = Date.now()
  try {
    const result = await cleanupSendcloudWebhookEvents(BATCH_SIZE)
    const durationMs = Date.now() - start
    console.log(
      JSON.stringify({
        job: 'sendcloud-retention-cleanup',
        deleted: result.deleted,
        retentionDays: getSendcloudWebhookRetentionDays(),
        durationMs,
        error: null,
      }),
    )
  } catch (err) {
    const durationMs = Date.now() - start
    console.error(
      JSON.stringify({
        job: 'sendcloud-retention-cleanup',
        deleted: 0,
        retentionDays: getSendcloudWebhookRetentionDays(),
        durationMs,
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
    )
  }
}

async function run(): Promise<void> {
  console.log(
    `[sendcloud-retention-cleanup] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE}, retentionDays=${getSendcloudWebhookRetentionDays()})`,
  )

  await tick()

  while (true) {
    if (!isRunning) break
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await tick()
  }

  console.log('[sendcloud-retention-cleanup] Shutting down gracefully')
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const result = await withJobLock('sendcloud-retention-cleanup', run)
  if (result === undefined) {
    console.log(
      '[sendcloud-retention-cleanup] Another instance is already running; exiting cleanly.',
    )
  }
}

main().catch((err) => {
  console.error('[sendcloud-retention-cleanup] Fatal error:', err)
  process.exit(1)
})
