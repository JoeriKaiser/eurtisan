/**
 * Email outbox worker.
 *
 * Drains pending rows from `email_outbox`, handles retries with exponential
 * backoff, and records every outcome in `email_send_log`.
 *
 * Configuration:
 *   EMAIL_OUTBOX_WORKER_INTERVAL_MS — polling interval (default: 10000)
 *   EMAIL_OUTBOX_WORKER_BATCH_SIZE  — max rows per tick (default: 50)
 *
 * Usage:
 *   bun run src/jobs/email-outbox-worker.ts
 */

import { deletePendingOutboxRowsForUser } from '#/lib/email-outbox.server'
import {
  processEmailOutboxTick,
  processOutboxBatch,
  sendOutboxRow,
} from '#/lib/email-outbox-processor.server'
import {
  getEmailMaxRetries,
  getEmailOutboxWorkerBatchSize,
  getEmailOutboxWorkerIntervalMs,
} from '#/lib/env.server'
import { withJobLock } from '#/lib/job-lock.server'
import { logger } from '#/lib/logger.server'
import { declareJobInterval, withJobMetrics } from '#/lib/with-job-metrics.server'

const INTERVAL_MS = getEmailOutboxWorkerIntervalMs()
const BATCH_SIZE = getEmailOutboxWorkerBatchSize()
const MAX_RETRIES = getEmailMaxRetries()

const JOB_NAME = 'email-outbox-worker'

let isRunning = true
let tickCount = 0

async function tick(): Promise<void> {
  tickCount += 1
  await processEmailOutboxTick(BATCH_SIZE, tickCount)
}

async function run(): Promise<void> {
  logger.info(
    `[email-outbox-worker] Started (interval=${INTERVAL_MS}ms, batchSize=${BATCH_SIZE}, maxRetries=${MAX_RETRIES})`,
    {
      job: JOB_NAME,
      intervalMs: INTERVAL_MS,
      batchSize: BATCH_SIZE,
      maxRetries: MAX_RETRIES,
    },
  )

  // Declares the cadence EurtisanJobStale measures this job against.
  declareJobInterval(JOB_NAME, INTERVAL_MS)

  // Run immediately on start, then on every interval.
  await withJobMetrics(JOB_NAME, tick)

  while (true) {
    if (!isRunning) break
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    await withJobMetrics(JOB_NAME, tick)
  }

  logger.info('[email-outbox-worker] Shutting down gracefully', { job: JOB_NAME })
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const result = await withJobLock(JOB_NAME, run)
  if (result === undefined) {
    logger.info('[email-outbox-worker] Another instance is already running; exiting cleanly.', {
      job: JOB_NAME,
    })
  }
}

if (!process.env.VITEST) {
  main().catch((err) => {
    logger.error('[email-outbox-worker] Fatal error:', err, { job: JOB_NAME })
    process.exit(1)
  })
}

// Re-export for compatibility contracts
export { deletePendingOutboxRowsForUser, processOutboxBatch, sendOutboxRow }
