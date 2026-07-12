/**
 * Pending Mollie payment reconciliation poller.
 *
 * Recovers classic payment callbacks that were delayed or missed by retrieving
 * authoritative Mollie state and invoking the same idempotent transition used
 * by the webhook endpoint.
 */
import {
  getMolliePaymentReconciliationBatchSize,
  getMolliePaymentReconciliationIntervalMs,
  getMolliePaymentReconciliationMinAgeMs,
} from '#/lib/env.server'
import { withJobLock } from '#/lib/job-lock.server'
import { logger } from '#/lib/logger.server'
import { reconcilePendingMolliePayments } from '#/lib/payments/mollie-reconciliation.server'
import { withJobMetrics } from '#/lib/with-job-metrics.server'

const JOB_NAME = 'mollie-payment-reconciliation'
const INTERVAL_MS = getMolliePaymentReconciliationIntervalMs()
const MIN_AGE_MS = getMolliePaymentReconciliationMinAgeMs()
const BATCH_SIZE = getMolliePaymentReconciliationBatchSize()

let isRunning = true

async function tick(): Promise<void> {
  const result = await reconcilePendingMolliePayments({
    minAgeMs: MIN_AGE_MS,
    batchSize: BATCH_SIZE,
  })

  if (result.checked > 0 || result.errors > 0) {
    logger.info(
      `[mollie-payment-reconciliation] Checked ${result.checked} payment(s), processed ${result.processed}, pending ${result.pending}, manual review ${result.manualReview}, errors ${result.errors}`,
      { job: JOB_NAME, ...result },
    )
  }

  if (result.errors > 0) {
    throw new Error(`Failed to reconcile ${result.errors} Mollie payment(s)`)
  }
}

async function run(): Promise<void> {
  logger.info(
    `[mollie-payment-reconciliation] Started (interval=${INTERVAL_MS}ms, minAge=${MIN_AGE_MS}ms, batchSize=${BATCH_SIZE})`,
    {
      job: JOB_NAME,
      intervalMs: INTERVAL_MS,
      minAgeMs: MIN_AGE_MS,
      batchSize: BATCH_SIZE,
    },
  )

  await withJobMetrics(JOB_NAME, tick)

  while (isRunning) {
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    if (isRunning) {
      await withJobMetrics(JOB_NAME, tick)
    }
  }

  logger.info('[mollie-payment-reconciliation] Shutting down gracefully', { job: JOB_NAME })
}

function shutdown(): void {
  isRunning = false
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const result = await withJobLock(JOB_NAME, run)
  if (result === undefined) {
    logger.info(
      '[mollie-payment-reconciliation] Another instance is already running; exiting cleanly.',
      { job: JOB_NAME },
    )
  }
}

main().catch((error) => {
  logger.error('[mollie-payment-reconciliation] Fatal error', error, {
    alert: true,
    job: JOB_NAME,
  })
  process.exit(1)
})
