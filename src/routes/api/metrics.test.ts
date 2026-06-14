import { describe, expect, it, vi } from 'vitest'

import { getMetricsResponse } from './metrics'

const mockGetMetricsBody = vi.fn()
const mockMetricsContentType = 'text/plain; version=0.0.4; charset=utf-8'

vi.mock('#/lib/metrics.server', () => ({
  getMetricsBody: () => mockGetMetricsBody(),
  metricsContentType: 'text/plain; version=0.0.4; charset=utf-8',
}))

describe('GET /api/metrics', () => {
  it('returns metrics when METRICS_TOKEN is unset', async () => {
    delete process.env.METRICS_TOKEN
    mockGetMetricsBody.mockResolvedValueOnce('# no metrics')

    const request = new Request('http://localhost/api/metrics')
    const response = await getMetricsResponse(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe(mockMetricsContentType)
    expect(await response.text()).toBe('# no metrics')
  })

  it('returns 401 when METRICS_TOKEN is set but no token is provided', async () => {
    process.env.METRICS_TOKEN = 'secret-token'

    const request = new Request('http://localhost/api/metrics')
    const response = await getMetricsResponse(request)

    expect(response.status).toBe(401)
  })

  it('returns metrics with a valid Authorization Bearer token', async () => {
    process.env.METRICS_TOKEN = 'secret-token'
    mockGetMetricsBody.mockResolvedValueOnce('# metrics')

    const request = new Request('http://localhost/api/metrics', {
      headers: { Authorization: 'Bearer secret-token' },
    })
    const response = await getMetricsResponse(request)

    expect(response.status).toBe(200)
  })

  it('returns metrics with a valid token query parameter', async () => {
    process.env.METRICS_TOKEN = 'secret-token'
    mockGetMetricsBody.mockResolvedValueOnce('# metrics')

    const request = new Request('http://localhost/api/metrics?token=secret-token')
    const response = await getMetricsResponse(request)

    expect(response.status).toBe(200)
  })

  it('returns 401 for an invalid token', async () => {
    process.env.METRICS_TOKEN = 'secret-token'

    const request = new Request('http://localhost/api/metrics?token=wrong')
    const response = await getMetricsResponse(request)

    expect(response.status).toBe(401)
  })
})
