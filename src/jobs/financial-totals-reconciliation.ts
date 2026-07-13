import {
  getFinancialTotalsReconciliationBatchSize,
  getFinancialTotalsReconciliationIntervalMs,
} from '#/lib/env.server'
import { withJobLock } from '#/lib/job-lock.server'
import {
  FINANCIAL_TOTALS_JOB_NAME,
  runFinancialTotalsReconciliation,
} from '#/lib/jobs/financial-totals-reconciliation.server'
import { startJobMetricsServer } from '#/lib/jobs/job-metrics-server.server'
import { logger } from '#/lib/logger.server'
import { jobLockContentionTotal } from '#/lib/metrics.server'
import { withJobMetrics } from '#/lib/with-job-metrics.server'

const INTERVAL_MS = getFinancialTotalsReconciliationIntervalMs()
const BATCH_SIZE = getFinancialTotalsReconciliationBatchSize()
const METRICS_PORT = 3001
const RUN_ONCE = process.argv.includes('--once')

let isRunning = true
let wakeSleep: (() => void) | undefined

function shutdown(): void {
  isRunning = false
  wakeSleep?.()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function sleepUntilNextRun(): Promise<void> {
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, INTERVAL_MS)
    wakeSleep = () => {
      clearTimeout(timeout)
      resolve()
    }
  })
  wakeSleep = undefined
}

async function run(): Promise<number> {
  logger.info('Financial totals reconciliation started', {
    job: FINANCIAL_TOTALS_JOB_NAME,
    intervalMs: INTERVAL_MS,
    batchSize: BATCH_SIZE,
    readOnly: true,
    runOnce: RUN_ONCE,
  })

  let lastMismatchCount = 0
  do {
    await withJobMetrics(
      FINANCIAL_TOTALS_JOB_NAME,
      async () => {
        const result = await runFinancialTotalsReconciliation(BATCH_SIZE)
        lastMismatchCount = result.mismatches
      },
      { rethrow: RUN_ONCE },
    )
    if (RUN_ONCE || !isRunning) break
    await sleepUntilNextRun()
  } while (isRunning)

  logger.info('Financial totals reconciliation shutting down', {
    job: FINANCIAL_TOTALS_JOB_NAME,
  })
  return lastMismatchCount
}

async function main(): Promise<void> {
  const metricsToken = process.env.METRICS_TOKEN
  if (!metricsToken) throw new Error('METRICS_TOKEN is required for the job metrics endpoint')
  const metricsServer = await startJobMetricsServer({ port: METRICS_PORT, token: metricsToken })

  try {
    const mismatchCount = await withJobLock(FINANCIAL_TOTALS_JOB_NAME, run)
    if (mismatchCount === undefined) {
      jobLockContentionTotal.inc({ job: FINANCIAL_TOTALS_JOB_NAME })
      logger.warn('Financial totals reconciliation lock contention', {
        alert: true,
        job: FINANCIAL_TOTALS_JOB_NAME,
      })
      if (RUN_ONCE) process.exitCode = 3
      return
    }
    if (RUN_ONCE && mismatchCount > 0) process.exitCode = 2
  } finally {
    await metricsServer.close()
  }
}

main().catch((error) => {
  logger.error('Financial totals reconciliation fatal error', error, {
    alert: true,
    job: FINANCIAL_TOTALS_JOB_NAME,
  })
  process.exitCode = 1
})
