/**
 * Reusable job tick wrapper that records Prometheus metrics and emits
 * structured alert logs on failure.
 *
 * Swallows errors so the caller's polling loop can continue; failures are
 * surfaced through metrics and logs instead of crashing the process.
 *
 * Used by all long-running background jobs in src/jobs/.
 */
import {
  jobIntervalSeconds,
  jobLastSuccessTimestamp,
  jobRunDurationSeconds,
  jobRunsTotal,
} from '#/lib/metrics.server'
import { logger } from '#/lib/logger.server'

/**
 * Declares a job's tick cadence so `EurtisanJobStale` can scale its threshold to
 * it. Call once at start-up, before the polling loop.
 *
 * A job that never declares one has no `eurtisan_job_interval_seconds` series,
 * and the alert's `unless` clause deliberately leaves it unmonitored rather than
 * guessing a threshold — an unmonitored job is visible as a gap in the metric,
 * whereas a wrong threshold is invisible.
 */
export function declareJobInterval(jobName: string, intervalMs: number): void {
  jobIntervalSeconds.set({ job_name: jobName }, intervalMs / 1000)
}

export async function withJobMetrics(
  jobName: string,
  fn: () => Promise<void>,
  options: { rethrow?: boolean } = {},
): Promise<void> {
  // `job_name`, not `job` — see the note on these metrics in metrics.server.ts.
  const end = jobRunDurationSeconds.startTimer({ job_name: jobName })

  try {
    await fn()

    jobRunsTotal.inc({ job_name: jobName, status: 'success' })
    jobLastSuccessTimestamp.set({ job_name: jobName }, Date.now() / 1000)
  } catch (error) {
    jobRunsTotal.inc({ job_name: jobName, status: 'failure' })
    logger.error(`Job tick failed: ${jobName}`, error, { alert: true, job: jobName })
    if (options.rethrow) throw error
  } finally {
    end()
  }
}
