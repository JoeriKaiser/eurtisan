import { createFileRoute } from '@tanstack/react-router'
import { statfs } from 'node:fs/promises'

import { getPoolStats, pool } from '#/db.ts'
import { getBrevoApiKey, getMockPaymentsEnabled, getMollieApiKey } from '#/lib/env.server.ts'
import { isMeilisearchHealthy } from '#/lib/meilisearch-products.server.ts'

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

const DISK_THRESHOLD_BYTES = 500 * 1024 * 1024 // 500 MB

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

async function checkDisk(): Promise<{
  healthy: boolean
  availableBytes: number
  totalBytes: number
}> {
  try {
    const stats = await statfs('/tmp')
    const availableBytes = stats.bavail * stats.bsize
    const totalBytes = stats.blocks * stats.bsize
    return {
      healthy: availableBytes > DISK_THRESHOLD_BYTES,
      availableBytes,
      totalBytes,
    }
  } catch {
    return { healthy: true, availableBytes: 0, totalBytes: 0 }
  }
}

async function runChecks(): Promise<{
  dbHealthy: boolean
  meilisearchHealthy: boolean
  mollieStatus: 'connected' | 'disconnected' | 'skipped'
  brevoStatus: 'connected' | 'disconnected' | 'skipped'
  diskStatus: { healthy: boolean; availableBytes: number; totalBytes: number }
}> {
  const [dbHealthy, meilisearchHealthy, mollieStatus, brevoStatus, diskStatus] = await Promise.all([
    checkDatabase(),
    checkMeilisearch(),
    checkMollie(),
    checkBrevo(),
    checkDisk(),
  ])
  return { dbHealthy, meilisearchHealthy, mollieStatus, brevoStatus, diskStatus }
}

function buildResult(
  dbHealthy: boolean,
  meilisearchHealthy: boolean,
  mollieStatus: 'connected' | 'disconnected' | 'skipped',
  brevoStatus: 'connected' | 'disconnected' | 'skipped',
  diskStatus: { healthy: boolean; availableBytes: number; totalBytes: number },
): HealthCheckResult {
  const criticalHealthy = dbHealthy && meilisearchHealthy
  const result: HealthCheckResult = {
    status: criticalHealthy ? 'ok' : 'error',
    db: dbHealthy ? 'connected' : 'disconnected',
    meilisearch: meilisearchHealthy ? 'connected' : 'disconnected',
    mollie: mollieStatus,
    brevo: brevoStatus,
    disk: diskStatus,
  }
  if (criticalHealthy) {
    result.pool = getPoolStats()
  }
  return result
}

/**
 * Full health check (legacy /api/health endpoint).
 */
export async function checkHealth(): Promise<{
  body: HealthCheckResult
  status: number
}> {
  const { dbHealthy, meilisearchHealthy, mollieStatus, brevoStatus, diskStatus } = await runChecks()
  const criticalHealthy = dbHealthy && meilisearchHealthy
  const body = buildResult(dbHealthy, meilisearchHealthy, mollieStatus, brevoStatus, diskStatus)
  return { body, status: criticalHealthy ? 200 : 503 }
}

/**
 * Readiness probe — 200 only if critical dependencies are up.
 */
export async function checkReady(): Promise<{
  body: HealthCheckResult
  status: number
}> {
  const { dbHealthy, meilisearchHealthy, mollieStatus, brevoStatus, diskStatus } = await runChecks()
  const criticalHealthy = dbHealthy && meilisearchHealthy
  const body = buildResult(dbHealthy, meilisearchHealthy, mollieStatus, brevoStatus, diskStatus)
  return { body, status: criticalHealthy ? 200 : 503 }
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
