import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkHealth } from './health'

const mockQuery = vi.fn()

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

describe('GET /api/health', () => {
  beforeEach(() => {
    mockQuery.mockReset()
  })

  it('returns 200 and ok status when database is reachable', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)

    const result = await checkHealth()

    expect(result.status).toBe(200)
    expect(result.body).toEqual({
      status: 'ok',
      db: 'connected',
      pool: { total: 5, idle: 2, waiting: 0 },
    })
    expect(mockQuery).toHaveBeenCalledWith('SELECT 1')
  })

  it('returns 503 and error status when database is unreachable', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection refused'))

    const result = await checkHealth()

    expect(result.status).toBe(503)
    expect(result.body).toEqual({ status: 'error', db: 'disconnected' })
    expect(mockQuery).toHaveBeenCalledWith('SELECT 1')
  })
})
