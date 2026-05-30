import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkHealth } from './health'

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
    expect(result.body).toEqual({
      status: 'ok',
      db: 'connected',
      meilisearch: 'connected',
      pool: { total: 5, idle: 2, waiting: 0 },
    })
    expect(mockQuery).toHaveBeenCalledWith('SELECT 1')
    expect(mockIsMeilisearchHealthy).toHaveBeenCalled()
  })

  it('returns 503 when database is unreachable', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection refused'))
    mockIsMeilisearchHealthy.mockResolvedValueOnce(true)

    const result = await checkHealth()

    expect(result.status).toBe(503)
    expect(result.body).toEqual({
      status: 'error',
      db: 'disconnected',
      meilisearch: 'connected',
    })
  })

  it('returns 503 when Meilisearch is unreachable', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
    mockIsMeilisearchHealthy.mockResolvedValueOnce(false)

    const result = await checkHealth()

    expect(result.status).toBe(503)
    expect(result.body).toEqual({
      status: 'error',
      db: 'connected',
      meilisearch: 'disconnected',
    })
  })

  it('returns 503 when both dependencies are unreachable', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection refused'))
    mockIsMeilisearchHealthy.mockResolvedValueOnce(false)

    const result = await checkHealth()

    expect(result.status).toBe(503)
    expect(result.body).toEqual({
      status: 'error',
      db: 'disconnected',
      meilisearch: 'disconnected',
    })
  })
})
