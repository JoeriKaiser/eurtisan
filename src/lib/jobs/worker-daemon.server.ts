/**
 * Unified Background Worker Daemon.
 *
 * Runs all registered background jobs concurrently within a single Bun/Node process.
 * Provides Prometheus metrics endpoint, graceful signal shutdown, and optional job filtering.
 */
import { setTimeout as sleep } from 'node:timers/promises'

import { withJobLock } from '#/lib/job-lock.server'
import { startJobMetricsServer } from '#/lib/jobs/job-metrics-server.server'
import { filterBackgroundJobs, type JobRunnerDefinition } from '#/lib/jobs/worker-registry.server'
import { logger } from '#/lib/logger.server'
import { declareJobInterval, withJobMetrics } from '#/lib/with-job-metrics.server'

export interface WorkerDaemonOptions {
  only?: string[]
  exclude?: string[]
  runOnce?: boolean
  metricsPort?: number
  metricsToken?: string
  signal?: AbortSignal
}

export interface WorkerDaemonResult {
  executedJobs: string[]
  successCount: number
  failureCount: number
}

async function runJobLoop(job: JobRunnerDefinition, signal: AbortSignal): Promise<void> {
  const intervalMs = job.getIntervalMs()
  declareJobInterval(job.name, intervalMs)

  logger.info(`[worker-daemon] Starting job loop: ${job.name} (interval=${intervalMs}ms)`, {
    job: job.name,
    intervalMs,
  })

  // Initial immediate tick with advisory lock
  await withJobLock(job.name, async () => {
    await withJobMetrics(job.name, job.tick)
  })

  while (!signal.aborted) {
    try {
      await sleep(intervalMs, undefined, { signal })
    } catch {
      if (signal.aborted) break
    }

    if (signal.aborted) break

    await withJobLock(job.name, async () => {
      await withJobMetrics(job.name, job.tick)
    })
  }

  logger.info(`[worker-daemon] Job loop stopped: ${job.name}`, { job: job.name })
}

export async function startWorkerDaemon(
  options: WorkerDaemonOptions = {},
): Promise<WorkerDaemonResult> {
  const jobs = filterBackgroundJobs({
    only: options.only,
    exclude: options.exclude,
  })

  if (jobs.length === 0) {
    logger.warn('[worker-daemon] No jobs selected to run.')
    return { executedJobs: [], successCount: 0, failureCount: 0 }
  }

  const jobNames = jobs.map((j) => j.name)
  logger.info(`[worker-daemon] Initializing with ${jobs.length} jobs: ${jobNames.join(', ')}`, {
    jobCount: jobs.length,
    jobs: jobNames,
    runOnce: options.runOnce ?? false,
  })

  const metricsToken = options.metricsToken ?? process.env.METRICS_TOKEN
  const metricsPort = options.metricsPort ?? Number.parseInt(process.env.METRICS_PORT ?? '3001', 10)
  let metricsServer: { close: () => Promise<void> } | undefined

  if (!options.runOnce && metricsToken) {
    try {
      metricsServer = await startJobMetricsServer({ port: metricsPort, token: metricsToken })
      logger.info(`[worker-daemon] Metrics server listening on port ${metricsPort}`, {
        port: metricsPort,
      })
    } catch (error) {
      logger.warn('[worker-daemon] Failed to start metrics server', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const shutdownController = new AbortController()
  const activeSignal = options.signal ?? shutdownController.signal

  try {
    if (options.runOnce) {
      let successCount = 0
      let failureCount = 0

      for (const job of jobs) {
        try {
          await withJobLock(job.name, async () => {
            await withJobMetrics(job.name, job.tick, { rethrow: true })
          })
          successCount += 1
        } catch (err) {
          failureCount += 1
          logger.error(`[worker-daemon] Job execution error: ${job.name}`, err, {
            job: job.name,
          })
        }
      }

      return { executedJobs: jobNames, successCount, failureCount }
    }

    // Continuous mode
    await Promise.all(jobs.map((job) => runJobLoop(job, activeSignal)))

    return { executedJobs: jobNames, successCount: jobs.length, failureCount: 0 }
  } finally {
    if (metricsServer) {
      await metricsServer.close().catch(() => {})
    }
  }
}
