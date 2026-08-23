import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { jobLockContentionTotal, metricsRegistry } from '#/lib/metrics.server'
import { getJobMetricsResponse, startJobMetricsServerFromEnv } from './job-metrics-server.server'

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
    jobLockContentionTotal.inc({ job_name: 'financial-totals-reconciliation' })
    const response = await getJobMetricsResponse(
      new Request(`http://job.internal/metrics?token=${TOKEN}`),
      TOKEN,
    )
    const body = await response.text()

    expect(body).toContain(
      'eurtisan_job_lock_contention_total{job_name="financial-totals-reconciliation"} 1',
    )
    expect(body).not.toContain('entityId')
  })
})

describe('startJobMetricsServerFromEnv', () => {
  const PORT = 39317

  afterEach(() => {
    delete process.env.METRICS_TOKEN
    delete process.env.METRICS_PORT
  })

  it('skips the endpoint when METRICS_TOKEN is unset', async () => {
    delete process.env.METRICS_TOKEN
    await expect(startJobMetricsServerFromEnv()).resolves.toBeUndefined()
  })

  it('serves token-gated metrics on METRICS_PORT', async () => {
    process.env.METRICS_TOKEN = TOKEN
    process.env.METRICS_PORT = String(PORT)
    const server = await startJobMetricsServerFromEnv()
    if (!server) throw new Error('expected the metrics server to start')
    try {
      const unauthorized = await fetch(`http://127.0.0.1:${PORT}/metrics`)
      expect(unauthorized.status).toBe(401)

      const authorized = await fetch(`http://127.0.0.1:${PORT}/metrics`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      })
      expect(authorized.status).toBe(200)
      expect(await authorized.text()).toContain('# HELP')
    } finally {
      await server.close()
    }
  })
})
