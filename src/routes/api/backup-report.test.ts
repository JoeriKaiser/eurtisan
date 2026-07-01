/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { metricsRegistry } from '#/lib/metrics.server'
import { logger } from '#/lib/logger.server'
import { Route } from './backup-report'

vi.mock('#/lib/logger.server', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

const getMetricValue = (name: string) => {
  const metric = metricsRegistry.getSingleMetric(name)
  if (!metric) return 0
  const hashMap = (metric as unknown as { hashMap: Record<string, { value: number }> }).hashMap
  const defaultEntry = hashMap['valueWithExemplarLabelNotSupported,']
  return defaultEntry?.value ?? 0
}

const createRequest = (body: unknown, token?: string): Request => {
  const url = new URL('http://localhost:3000/api/backup-report')
  if (token) {
    url.searchParams.set('token', token)
  }
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/backup-report', () => {
  const handler = (
    Route as {
      server?: { handlers?: { POST?: (args: { request: Request }) => Promise<Response> } }
    }
  ).server?.handlers?.POST

  beforeEach(() => {
    metricsRegistry.resetMetrics()
    vi.stubEnv('BACKUP_REPORT_TOKEN', 'test-backup-token')
    vi.stubEnv('METRICS_TOKEN', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('returns 401 when no token is provided', async () => {
    if (!handler) return
    const request = createRequest({ status: 'success' })
    const response = await handler({ request })
    expect(response.status).toBe(401)
  })

  it('increments success counter on valid success report', async () => {
    if (!handler) return
    const request = createRequest(
      { status: 'success', file: '/backups/test.sql.gz' },
      'test-backup-token',
    )
    const response = await handler({ request })
    expect(response.status).toBe(200)
    expect(getMetricValue('eurtisan_backup_success_total')).toBe(1)
    expect(getMetricValue('eurtisan_backup_failures_total')).toBe(0)
    expect(logger.info).toHaveBeenCalledWith('Backup reported as successful', {
      file: '/backups/test.sql.gz',
    })
  })

  it('increments failure counter and logs alert on valid failure report', async () => {
    if (!handler) return
    const request = createRequest(
      { status: 'failure', error: 'upload failed' },
      'test-backup-token',
    )
    const response = await handler({ request })
    expect(response.status).toBe(200)
    expect(getMetricValue('eurtisan_backup_success_total')).toBe(0)
    expect(getMetricValue('eurtisan_backup_failures_total')).toBe(1)
    expect(logger.error).toHaveBeenCalledWith(
      'Backup reported as failed',
      expect.any(Error),
      expect.objectContaining({ alert: true, error: 'upload failed' }),
    )
  })

  it('falls back to METRICS_TOKEN when BACKUP_REPORT_TOKEN is unset', async () => {
    vi.unstubAllEnvs()
    vi.stubEnv('BACKUP_REPORT_TOKEN', '')
    vi.stubEnv('METRICS_TOKEN', 'test-metrics-token')
    if (!handler) return
    const request = createRequest({ status: 'success' }, 'test-metrics-token')
    const response = await handler({ request })
    expect(response.status).toBe(200)
  })

  it('returns 400 for invalid payload', async () => {
    if (!handler) return
    const request = createRequest({ status: 'unknown' }, 'test-backup-token')
    const response = await handler({ request })
    expect(response.status).toBe(400)
  })
})
