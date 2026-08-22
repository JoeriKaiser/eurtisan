import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkDependencies, checkHealth, checkLive, checkReady } from './health'

const mockQuery = vi.fn()
const mockIsMeilisearchHealthy = vi.fn()
const mockDbSelect = vi.fn()

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

vi.mock('#/db/index', () => ({
  db: {
    select: () => mockDbSelect(),
  },
}))

vi.mock('#/lib/meilisearch-products.server.ts', () => ({
  isMeilisearchHealthy: () => mockIsMeilisearchHealthy(),
}))

vi.mock('#/lib/env.server.ts', async () => {
  const actual = await vi.importActual<typeof import('#/lib/env.server.ts')>('#/lib/env.server.ts')
  return {
    getMollieApiKey: () => undefined,
    getMockPaymentsEnabled: () => true,
    getBrevoApiKey: () => undefined,
    getHealthDiskThresholdBytes: actual.getHealthDiskThresholdBytes,
  }
})

describe('GET /api/health', () => {
  beforeEach(() => {
    mockQuery.mockReset()
    mockIsMeilisearchHealthy.mockReset()
  })

  it('returns 200 and ok status when critical dependencies are healthy', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
    mockIsMeilisearchHealthy.mockResolvedValueOnce(true)

    const result = await checkHealth()

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      status: 'ok',
      db: 'connected',
      meilisearch: 'connected',
      disk: { healthy: true },
      pool: { total: 5, idle: 2, waiting: 0 },
    })
    expect(result.body.mollie).toBeUndefined()
    expect(result.body.brevo).toBeUndefined()
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
      disk: { healthy: true },
    })
  })

  it('returns 200 when Meilisearch is unreachable because DB fallback is active', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
    mockIsMeilisearchHealthy.mockResolvedValueOnce(false)

    const result = await checkHealth()

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      status: 'ok',
      db: 'connected',
      meilisearch: 'disconnected',
      disk: { healthy: true },
    })
  })

  it('returns 503 when disk is unhealthy', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
    mockIsMeilisearchHealthy.mockResolvedValueOnce(true)
    vi.stubGlobal('process', {
      ...process,
      env: { ...process.env, HEALTH_DISK_THRESHOLD_BYTES: '999999999999999' },
    })

    const result = await checkHealth()

    expect(result.status).toBe(503)
    expect(result.body.disk?.healthy).toBe(false)

    vi.unstubAllGlobals()
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
      disk: { healthy: true },
      pool: { total: 5, idle: 2, waiting: 0 },
    })
    expect(result.body.mollie).toBeUndefined()
    expect(result.body.brevo).toBeUndefined()
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
      disk: { healthy: true },
    })
  })

  it('returns 200 when Meilisearch is unreachable because DB fallback is active', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
    mockIsMeilisearchHealthy.mockResolvedValueOnce(false)

    const result = await checkReady()

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      status: 'ok',
      db: 'connected',
      meilisearch: 'disconnected',
      disk: { healthy: true },
    })
  })
})

describe('GET /api/health/deps', () => {
  beforeEach(() => {
    mockQuery.mockReset()
    mockIsMeilisearchHealthy.mockReset()
    mockDbSelect.mockReset()
    vi.stubEnv('IMGPROXY_HEALTH_URL', '')
    vi.stubEnv('S3_ENDPOINT', '')
    vi.stubEnv('S3_BUCKET', '')
    vi.stubEnv('S3_REGION', '')
    vi.stubEnv('S3_ACCESS_KEY_ID', '')
    vi.stubEnv('S3_SECRET_ACCESS_KEY', '')
  })

  it('returns 200 and includes external provider status when critical deps are healthy', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
    mockIsMeilisearchHealthy.mockResolvedValueOnce(true)
    mockDbSelect.mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([{ count: 0 }]),
      }),
    })

    const result = await checkDependencies()

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      status: 'ok',
      db: 'connected',
      meilisearch: 'connected',
      mollie: 'skipped',
      brevo: 'skipped',
      imgproxy: 'skipped',
      s3: 'skipped',
      emailOutboxBacklog: 0,
      disk: { healthy: true },
    })
  })

  it('returns 503 when imgproxy is disconnected', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
    mockIsMeilisearchHealthy.mockResolvedValueOnce(true)
    vi.stubEnv('IMGPROXY_HEALTH_URL', 'http://imgproxy:8080/health')
    vi.stubGlobal('fetch', () => Promise.reject(new Error('connection refused')))
    mockDbSelect.mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([{ count: 0 }]),
      }),
    })

    const result = await checkDependencies()

    expect(result.status).toBe(503)
    expect(result.body.imgproxy).toBe('disconnected')

    vi.unstubAllGlobals()
  })

  it('reports email outbox backlog count', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
    mockIsMeilisearchHealthy.mockResolvedValueOnce(true)
    mockDbSelect.mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([{ count: 42 }]),
      }),
    })

    const result = await checkDependencies()

    expect(result.status).toBe(200)
    expect(result.body.emailOutboxBacklog).toBe(42)
  })
})
