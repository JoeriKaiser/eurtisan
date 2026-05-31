import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkHealth, checkLive, checkReady } from './health'

const mockQuery = vi.fn()
const mockIsMeilisearchHealthy = vi.fn()

vi.mock('#/db.ts', () => ({
  pool: {
    get query() {
      return mockQuery
    },
  },
  getPoolStats() {
    return { total: 5, idle: 2, waiting: 0 }
  },
}))

vi.mock('#/lib/meilisearch-products.server.ts', () => ({
  isMeilisearchHealthy: () => mockIsMeilisearchHealthy(),
}))

vi.mock('#/lib/env.server.ts', () => ({
  getMollieApiKey: () => undefined,
  getMockPaymentsEnabled: () => true,
  getBrevoApiKey: () => undefined,
}))

describe('GET /api/health', () => {
  beforeEach(() => {
    mockQuery.mockReset()
    mockIsMeilisearchHealthy.mockReset()
  })

  it('returns 200 and ok status when all dependencies are healthy', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
    mockIsMeilisearchHealthy.mockResolvedValueOnce(true)

    const result = await checkHealth()

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      status: 'ok',
      db: 'connected',
      meilisearch: 'connected',
      mollie: 'skipped',
      brevo: 'skipped',
      disk: { healthy: true },
      pool: { total: 5, idle: 2, waiting: 0 },
    })
    expect(result.body.disk).toBeDefined()
    expect(result.body.disk?.availableBytes).toBeGreaterThan(0)
    expect(result.body.disk?.totalBytes).toBeGreaterThan(0)
    expect(mockQuery).toHaveBeenCalledWith('SELECT 1')
    expect(mockIsMeilisearchHealthy).toHaveBeenCalled()
  })

  it('returns 503 when database is unreachable', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection refused'))
    mockIsMeilisearchHealthy.mockResolvedValueOnce(true)

    const result = await checkHealth()

    expect(result.status).toBe(503)
    expect(result.body).toMatchObject({
      status: 'error',
      db: 'disconnected',
      meilisearch: 'connected',
      mollie: 'skipped',
      brevo: 'skipped',
      disk: { healthy: true },
    })
  })

  it('returns 503 when Meilisearch is unreachable', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
    mockIsMeilisearchHealthy.mockResolvedValueOnce(false)

    const result = await checkHealth()

    expect(result.status).toBe(503)
    expect(result.body).toMatchObject({
      status: 'error',
      db: 'connected',
      meilisearch: 'disconnected',
      mollie: 'skipped',
      brevo: 'skipped',
      disk: { healthy: true },
    })
  })

  it('returns 503 when both dependencies are unreachable', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection refused'))
    mockIsMeilisearchHealthy.mockResolvedValueOnce(false)

    const result = await checkHealth()

    expect(result.status).toBe(503)
    expect(result.body).toMatchObject({
      status: 'error',
      db: 'disconnected',
      meilisearch: 'disconnected',
      mollie: 'skipped',
      brevo: 'skipped',
      disk: { healthy: true },
    })
  })
})

describe('GET /api/health/live', () => {
  it('always returns 200', () => {
    const result = checkLive()
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ status: 'ok' })
  })
})

describe('GET /api/health/ready', () => {
  beforeEach(() => {
    mockQuery.mockReset()
    mockIsMeilisearchHealthy.mockReset()
  })

  it('returns 200 when critical dependencies are healthy', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
    mockIsMeilisearchHealthy.mockResolvedValueOnce(true)

    const result = await checkReady()

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      status: 'ok',
      db: 'connected',
      meilisearch: 'connected',
      mollie: 'skipped',
      brevo: 'skipped',
      disk: { healthy: true },
      pool: { total: 5, idle: 2, waiting: 0 },
    })
  })

  it('returns 503 when database is unreachable', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection refused'))
    mockIsMeilisearchHealthy.mockResolvedValueOnce(true)

    const result = await checkReady()

    expect(result.status).toBe(503)
    expect(result.body).toMatchObject({
      status: 'error',
      db: 'disconnected',
      meilisearch: 'connected',
      mollie: 'skipped',
      brevo: 'skipped',
      disk: { healthy: true },
    })
  })

  it('returns 503 when Meilisearch is unreachable', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
    mockIsMeilisearchHealthy.mockResolvedValueOnce(false)

    const result = await checkReady()

    expect(result.status).toBe(503)
    expect(result.body).toMatchObject({
      status: 'error',
      db: 'connected',
      meilisearch: 'disconnected',
      mollie: 'skipped',
      brevo: 'skipped',
      disk: { healthy: true },
    })
  })
})
