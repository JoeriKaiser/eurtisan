/**
 * Email retention cleanup poller.
 *
 * Runs continuously in the background, periodically deleting terminal outbox
 * rows, old send log rows, and stale Brevo webhook events.
 *
 * Configuration:
 *   EMAIL_RETENTION_CLEANUP_INTERVAL_MS — polling interval (default: 86400000)
 *   EMAIL_RETENTION_CLEANUP_BATCH_SIZE  — max rows per table per run (default: 1000)
 *
 * Usage:
 *   bun run src/jobs/email-retention-cleanup.ts
 */
import {
  cleanupBrevoWebhookEvents,
  cleanupEmailOutbox,
  cleanupEmailSendLog,
} from '#/lib/email-retention-cleanup.server'

const INTERVAL_MS = Number.parseInt(
  process.env.EMAIL_RETENTION_CLEANUP_INTERVAL_MS ?? '86400000',
  10,
)
const BATCH_SIZE = Number.parseInt(process.env.EMAIL_RETENTION_CLEANUP_BATCH_SIZE ?? '1000', 10)

let isRunning = true

async function tick(): Promise<void> {
  try {
    const [outbox, sendLog, webhookEvents] = await Promise.all([
      cleanupEmailOutbox(BATCH_SIZE),
      cleanupEmailSendLog(BATCH_SIZE),
      cleanupBrevoWebhookEvents(BATCH_SIZE),
    ])

    if (outbox.deleted > 0 || sendLog.deleted > 0 || webhookEvents.deleted > 0) {
      console.log(
        `[email-retention-cleanup] Deleted outbox=${outbox.deleted}, send_log=${sendLog.deleted}, brevo_webhook_event=${webhookEvents.deleted}`,
      )
    }
  } catch (err) {
    console.error('[email-retention-cleanup] Error cleaning up email retention:', err)
  }
}

async function main(): Promise<void> {
  console.log(
    `[email-retention-cleanup] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE})`,
  )

  await tick()

  while (true) {
    if (!isRunning) break
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await tick()
  }

  console.log('[email-retention-cleanup] Shutting down gracefully')
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

main().catch((err) => {
  console.error('[email-retention-cleanup] Fatal error:', err)
  process.exit(1)
})
