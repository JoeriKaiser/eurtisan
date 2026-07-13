import { beforeEach, describe, expect, it } from 'vitest'

import { jobLockContentionTotal, metricsRegistry } from '#/lib/metrics.server'
import { getJobMetricsResponse } from './job-metrics-server.server'

const TOKEN = 'test-job-metrics-token-value'

describe('job metrics endpoint', () => {
  beforeEach(() => metricsRegistry.resetMetrics())

  it('requires the configured token and never returns it', async () => {
    const unauthorized = await getJobMetricsResponse(
      new Request('http://job.internal/metrics'),
      TOKEN,
    )
    expect(unauthorized.status).toBe(401)
    expect(await unauthorized.text()).not.toContain(TOKEN)

    const authorized = await getJobMetricsResponse(
      new Request('http://job.internal/metrics', {
        headers: { Authorization: `Bearer ${TOKEN}` },
      }),
      TOKEN,
    )
    expect(authorized.status).toBe(200)
    expect(await authorized.text()).not.toContain(TOKEN)
  })

  it('exports lock contention without high-cardinality labels', async () => {
    jobLockContentionTotal.inc({ job: 'financial-totals-reconciliation' })
    const response = await getJobMetricsResponse(
      new Request(`http://job.internal/metrics?token=${TOKEN}`),
      TOKEN,
    )
    const body = await response.text()

    expect(body).toContain(
      'eurtisan_job_lock_contention_total{job="financial-totals-reconciliation"} 1',
    )
    expect(body).not.toContain('entityId')
  })
})
