/**
 * Reusable job tick wrapper that records Prometheus metrics and emits
 * structured alert logs on failure.
 *
 * Swallows errors so the caller's polling loop can continue; failures are
 * surfaced through metrics and logs instead of crashing the process.
 *
 * Used by all long-running background jobs in src/jobs/.
 */
import { jobLastSuccessTimestamp, jobRunDurationSeconds, jobRunsTotal } from '#/lib/metrics.server'
import { logger } from '#/lib/logger.server'

export async function withJobMetrics(jobName: string, fn: () => Promise<void>): Promise<void> {
  const end = jobRunDurationSeconds.startTimer({ job: jobName })

  try {
    await fn()

    jobRunsTotal.inc({ job: jobName, status: 'success' })
    jobLastSuccessTimestamp.set({ job: jobName }, Date.now() / 1000)
  } catch (error) {
    jobRunsTotal.inc({ job: jobName, status: 'failure' })
    logger.error(`Job tick failed: ${jobName}`, error, { alert: true, job: jobName })
  } finally {
    end()
  }
}
