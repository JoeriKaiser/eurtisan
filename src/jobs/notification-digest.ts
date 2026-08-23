/**
 * Durable daily seller digest poller.
 *
 * Each run considers only the prior completed UTC day. The domain operation
 * owns aggregation and idempotency; this process owns scheduling and metrics.
 */
import { setTimeout as sleep } from 'node:timers/promises'

import { getNotificationDigestIntervalMs } from '#/lib/env.server'
import { withJobLock } from '#/lib/job-lock.server'
import { startJobMetricsServerFromEnv } from '#/lib/jobs/job-metrics-server.server'
import { logger } from '#/lib/logger.server'
import { enqueuePreviousUtcDayDigests } from '#/lib/notifications/digest.server'
import { declareJobInterval, withJobMetrics } from '#/lib/with-job-metrics.server'

const JOB_NAME = 'notification-digest'
const INTERVAL_MS = getNotificationDigestIntervalMs()

let isRunning = true
const shutdownController = new AbortController()

async function tick(): Promise<void> {
  const result = await enqueuePreviousUtcDayDigests()
  logger.info('notification.digest.batch', { job: JOB_NAME, ...result })
}

async function run(): Promise<void> {
  logger.info('[notification-digest] Started', {
    job: JOB_NAME,
    intervalMs: INTERVAL_MS,
  })
  declareJobInterval(JOB_NAME, INTERVAL_MS)
  await withJobMetrics(JOB_NAME, tick)

  while (isRunning) {
    try {
      await sleep(INTERVAL_MS, undefined, { signal: shutdownController.signal })
    } catch (error) {
      if (shutdownController.signal.aborted) break
      throw error
    }
    if (isRunning) await withJobMetrics(JOB_NAME, tick)
  }

  logger.info('[notification-digest] Shutting down gracefully', { job: JOB_NAME })
}

function shutdown(): void {
  isRunning = false
  shutdownController.abort()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

async function main(): Promise<void> {
  const metricsServer = await startJobMetricsServerFromEnv()
  try {
    const result = await withJobLock(JOB_NAME, run)
    if (result === undefined) {
      logger.info('[notification-digest] Another instance is already running; exiting cleanly.', {
        job: JOB_NAME,
      })
    }
  } finally {
    await metricsServer?.close()
  }
}

if (!process.env.VITEST) {
  main().catch((error) => {
    logger.error('[notification-digest] Fatal error', error, { job: JOB_NAME })
    process.exit(1)
  })
}
