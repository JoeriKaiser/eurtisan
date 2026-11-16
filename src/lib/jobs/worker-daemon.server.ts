/**
 * Unified Background Worker Daemon.
 *
 * Runs all registered background jobs concurrently within a single Bun/Node process.
 * Provides Prometheus metrics endpoint, graceful signal shutdown, and optional job filtering.
 */
import { setTimeout as sleep } from 'node:timers/promises'

import { shutdownPool } from '#/db'
import { withJobLock } from '#/lib/job-lock.server'
import { startJobMetricsServer } from '#/lib/jobs/job-metrics-server.server'
import { filterBackgroundJobs, type JobRunnerDefinition } from '#/lib/jobs/worker-registry.server'
import { logger } from '#/lib/logger.server'
import { declareJobInterval, withJobMetrics } from '#/lib/with-job-metrics.server'

const DEFAULT_STARTUP_STAGGER_MS = 750

export interface WorkerDaemonOptions {
  only?: string[]
  exclude?: string[]
  runOnce?: boolean
  initialStaggerMs?: number
  metricsPort?: number
  metricsToken?: string
  signal?: AbortSignal
}

export interface WorkerDaemonResult {
  executedJobs: string[]
  successCount: number
  failureCount: number
}

async function runJobLoop(
  job: JobRunnerDefinition,
  signal: AbortSignal,
  initialDelayMs: number,
): Promise<void> {
  const intervalMs = job.getIntervalMs()
  declareJobInterval(job.name, intervalMs)

  logger.info(
    `[worker-daemon] Starting job loop: ${job.name} (interval=${intervalMs}ms, initialDelay=${initialDelayMs}ms)`,
    {
      job: job.name,
      intervalMs,
      initialDelayMs,
    },
  )

  if (initialDelayMs > 0) {
    try {
      await sleep(initialDelayMs, undefined, { signal })
    } catch {
      if (signal.aborted) {
        logger.info(`[worker-daemon] Job loop stopped before initial tick: ${job.name}`, {
          job: job.name,
        })
        return
      }
    }
  }

  if (signal.aborted) {
    logger.info(`[worker-daemon] Job loop stopped: ${job.name}`, { job: job.name })
    return
  }

  const executeTick = async (): Promise<void> => {
    try {
      await withJobLock(job.name, async () => {
        await withJobMetrics(job.name, job.tick)
      })
    } catch (error) {
      logger.error(`[worker-daemon] Job tick error: ${job.name}`, error, {
        job: job.name,
      })
    }
  }

  await executeTick()

  while (!signal.aborted) {
    try {
      await sleep(intervalMs, undefined, { signal })
    } catch {
      if (signal.aborted) break
    }

    if (signal.aborted) break

    await executeTick()
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
  const staggerMs = options.initialStaggerMs ?? DEFAULT_STARTUP_STAGGER_MS

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

    await Promise.all(jobs.map((job, index) => runJobLoop(job, activeSignal, index * staggerMs)))

    return { executedJobs: jobNames, successCount: jobs.length, failureCount: 0 }
  } finally {
    if (metricsServer) {
      await metricsServer.close().catch(() => {})
    }
    if (!process.env.VITEST) {
      await shutdownPool().catch(() => {})
    }
  }
}
