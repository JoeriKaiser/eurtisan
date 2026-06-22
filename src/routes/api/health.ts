import { createFileRoute } from '@tanstack/react-router'
import { statfs } from 'node:fs/promises'

import { getPoolStats, pool } from '#/db.ts'
import { getBrevoApiKey, getMockPaymentsEnabled, getMollieApiKey } from '#/lib/env.server.ts'
import { isMeilisearchHealthy } from '#/lib/meilisearch-products.server.ts'
import {
  diskAvailableBytes,
  healthBrevoConnected,
  healthDbConnected,
  healthDiskHealthy,
  healthMeilisearchConnected,
  healthMollieConnected,
} from '#/lib/metrics.server.ts'

export interface HealthCheckResult {
  status: 'ok' | 'error'
  db: 'connected' | 'disconnected'
  meilisearch: 'connected' | 'disconnected'
  mollie?: 'connected' | 'disconnected' | 'skipped'
  brevo?: 'connected' | 'disconnected' | 'skipped'
  disk?: { healthy: boolean; availableBytes: number; totalBytes: number }
  pool?: {
    total: number
    idle: number
    waiting: number
  }
}

function getDiskThresholdBytes(): number {
  const raw = process.env.HEALTH_DISK_THRESHOLD_BYTES
  if (raw) {
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return 500 * 1024 * 1024 // 500 MB
}

async function checkDatabase(): Promise<boolean> {
  try {
    await pool.query('SELECT 1')
    return true
  } catch {
    return false
  }
}

async function checkMeilisearch(): Promise<boolean> {
  return isMeilisearchHealthy()
}

async function checkMollie(): Promise<'connected' | 'disconnected' | 'skipped'> {
  const apiKey = getMollieApiKey()
  const mockEnabled = getMockPaymentsEnabled()
  if (!apiKey || mockEnabled) {
    return 'skipped'
  }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const response = await fetch(
      'https://api.mollie.com/v2/methods?amount[currency]=EUR&amount[value]=10.00',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      },
    )
    clearTimeout(timeout)
    return response.ok ? 'connected' : 'disconnected'
  } catch {
    return 'disconnected'
  }
}

async function checkBrevo(): Promise<'connected' | 'disconnected' | 'skipped'> {
  const apiKey = getBrevoApiKey()
  if (!apiKey) {
    return 'skipped'
  }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const response = await fetch('https://api.brevo.com/v3/account', {
      method: 'GET',
      headers: { 'api-key': apiKey, Accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return response.ok ? 'connected' : 'disconnected'
  } catch {
    return 'disconnected'
  }
}

/**
 * Disk-space check for the health endpoint.
 *
 * `HEALTH_DISK_PATH` can be set to the mount point that actually stores
 * application data (e.g. `/var/lib/postgresql/data` for the database volume or
 * `/` for the app container root). The previous default of `/tmp` reported the
 * wrong filesystem and could mask disk-pressure issues.
 *
 * `HEALTH_DISK_THRESHOLD_BYTES` configures the minimum free bytes considered
 * healthy (default: 500 MB).
 */
async function checkDisk(): Promise<{
  healthy: boolean
  availableBytes: number
  totalBytes: number
}> {
  const path = process.env.HEALTH_DISK_PATH || '/'
  try {
    const stats = await statfs(path)
    const availableBytes = stats.bavail * stats.bsize
    const totalBytes = stats.blocks * stats.bsize
    return {
      healthy: availableBytes > getDiskThresholdBytes(),
      availableBytes,
      totalBytes,
    }
  } catch {
    return { healthy: true, availableBytes: 0, totalBytes: 0 }
  }
}

async function runCriticalChecks(): Promise<{
  dbHealthy: boolean
  meilisearchHealthy: boolean
  diskStatus: { healthy: boolean; availableBytes: number; totalBytes: number }
}> {
  const [dbHealthy, meilisearchHealthy, diskStatus] = await Promise.all([
    checkDatabase(),
    checkMeilisearch(),
    checkDisk(),
  ])

  healthDbConnected.set(dbHealthy ? 1 : 0)
  healthMeilisearchConnected.set(meilisearchHealthy ? 1 : 0)
  healthDiskHealthy.set(diskStatus.healthy ? 1 : 0)
  diskAvailableBytes.set(diskStatus.availableBytes)

  return { dbHealthy, meilisearchHealthy, diskStatus }
}

async function runDependencyChecks(): Promise<{
  mollieStatus: 'connected' | 'disconnected' | 'skipped'
  brevoStatus: 'connected' | 'disconnected' | 'skipped'
}> {
  const [mollieStatus, brevoStatus] = await Promise.all([checkMollie(), checkBrevo()])

  healthMollieConnected.set(mollieStatus === 'connected' || mollieStatus === 'skipped' ? 1 : 0)
  healthBrevoConnected.set(brevoStatus === 'connected' || brevoStatus === 'skipped' ? 1 : 0)

  return { mollieStatus, brevoStatus }
}

function buildResult(
  dbHealthy: boolean,
  meilisearchHealthy: boolean,
  mollieStatus: 'connected' | 'disconnected' | 'skipped' | undefined,
  brevoStatus: 'connected' | 'disconnected' | 'skipped' | undefined,
  diskStatus: { healthy: boolean; availableBytes: number; totalBytes: number },
): HealthCheckResult {
  const criticalHealthy = dbHealthy && meilisearchHealthy && diskStatus.healthy
  const result: HealthCheckResult = {
    status: criticalHealthy ? 'ok' : 'error',
    db: dbHealthy ? 'connected' : 'disconnected',
    meilisearch: meilisearchHealthy ? 'connected' : 'disconnected',
    disk: diskStatus,
  }
  if (mollieStatus !== undefined) {
    result.mollie = mollieStatus
  }
  if (brevoStatus !== undefined) {
    result.brevo = brevoStatus
  }
  if (criticalHealthy) {
    result.pool = getPoolStats()
  }
  return result
}

/**
 * Full health check (legacy /api/health endpoint).
 *
 * Limited to critical dependencies only; external provider status is available
 * at /api/health/deps so readiness/liveness probes are not affected by
 * third-party latency.
 */
export async function checkHealth(): Promise<{
  body: HealthCheckResult
  status: number
}> {
  const { dbHealthy, meilisearchHealthy, diskStatus } = await runCriticalChecks()
  const criticalHealthy = dbHealthy && meilisearchHealthy && diskStatus.healthy
  const body = buildResult(dbHealthy, meilisearchHealthy, undefined, undefined, diskStatus)
  return { body, status: criticalHealthy ? 200 : 503 }
}

/**
 * Readiness probe — 200 only if critical dependencies are up.
 */
export async function checkReady(): Promise<{
  body: HealthCheckResult
  status: number
}> {
  const { dbHealthy, meilisearchHealthy, diskStatus } = await runCriticalChecks()
  const criticalHealthy = dbHealthy && meilisearchHealthy && diskStatus.healthy
  const body = buildResult(dbHealthy, meilisearchHealthy, undefined, undefined, diskStatus)
  return { body, status: criticalHealthy ? 200 : 503 }
}

/**
 * Dependency probe — reports external provider status (Mollie, Brevo) without
 * impacting readiness decisions.
 */
export async function checkDependencies(): Promise<{
  body: HealthCheckResult
  status: number
}> {
  const { dbHealthy, meilisearchHealthy, diskStatus } = await runCriticalChecks()
  const { mollieStatus, brevoStatus } = await runDependencyChecks()
  const depsHealthy =
    (mollieStatus === 'connected' || mollieStatus === 'skipped') &&
    (brevoStatus === 'connected' || brevoStatus === 'skipped')
  const body = buildResult(dbHealthy, meilisearchHealthy, mollieStatus, brevoStatus, diskStatus)
  return { body, status: depsHealthy ? 200 : 503 }
}

/**
 * Liveness probe — always 200 if the process is running.
 */
export function checkLive(): { body: { status: 'ok' }; status: number } {
  return { body: { status: 'ok' }, status: 200 }
}

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        const { body, status } = await checkHealth()
        return new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
