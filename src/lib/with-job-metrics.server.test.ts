/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { metricsRegistry } from '#/lib/metrics.server'
import { logger } from '#/lib/logger.server'
import { withJobMetrics } from '#/lib/with-job-metrics.server'

vi.mock('#/lib/logger.server', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

const getMetricValue = (name: string, labels: Record<string, string> = {}) => {
  const metric = metricsRegistry.getSingleMetric(name)
  if (!metric) return 0
  const hashMap = (
    metric as unknown as {
      hashMap: Record<string, { value: number; labels: Record<string, string> }>
    }
  ).hashMap
  const match = Object.values(hashMap).find((v) =>
    Object.entries(labels).every(([key, value]) => v.labels[key] === value),
  )
  return match?.value ?? 0
}

describe('withJobMetrics', () => {
  beforeEach(() => {
    metricsRegistry.resetMetrics()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('increments success counter and sets last success timestamp on success', async () => {
    const before = Date.now() / 1000
    await withJobMetrics('test-job', async () => {
      // no-op
    })
    const after = Date.now() / 1000

    expect(getMetricValue('eurtisan_job_runs_total', { job: 'test-job', status: 'success' })).toBe(
      1,
    )
    expect(getMetricValue('eurtisan_job_runs_total', { job: 'test-job', status: 'failure' })).toBe(
      0,
    )

    const lastSuccess = getMetricValue('eurtisan_job_last_success_timestamp', { job: 'test-job' })
    expect(lastSuccess).toBeGreaterThanOrEqual(before)
    expect(lastSuccess).toBeLessThanOrEqual(after)

    expect(logger.error).not.toHaveBeenCalled()
  })

  it('increments failure counter and logs an alert on failure', async () => {
    const error = new Error('tick failed')

    await withJobMetrics('test-job', async () => {
      throw error
    })

    expect(getMetricValue('eurtisan_job_runs_total', { job: 'test-job', status: 'success' })).toBe(
      0,
    )
    expect(getMetricValue('eurtisan_job_runs_total', { job: 'test-job', status: 'failure' })).toBe(
      1,
    )
    expect(logger.error).toHaveBeenCalledWith('Job tick failed: test-job', error, {
      alert: true,
      job: 'test-job',
    })
  })

  it('does not throw when the wrapped function fails', async () => {
    await expect(
      withJobMetrics('test-job', async () => {
        throw new Error('expected failure')
      }),
    ).resolves.toBeUndefined()
  })
})
