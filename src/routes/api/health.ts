import { createFileRoute } from '@tanstack/react-router'
import { statfs } from 'node:fs/promises'

import { and, inArray, lt, sql } from 'drizzle-orm'
import { getPoolStats, pool } from '#/db.ts'
import { db } from '#/db/index'
import { emailOutbox } from '#/db/schema'
import {
  getBrevoApiKey,
  getHealthDiskThresholdBytes,
  getMockPaymentsEnabled,
  getMollieApiKey,
} from '#/lib/env.server.ts'
import { isMeilisearchHealthy } from '#/lib/meilisearch-products.server.ts'
import {
  diskAvailableBytes,
  emailOutboxBacklog,
  healthBrevoConnected,
  healthDbConnected,
  healthDiskHealthy,
  healthImgproxyConnected,
  healthMeilisearchConnected,
  healthMollieConnected,
  healthS3Connected,
} from '#/lib/metrics.server.ts'

export interface HealthCheckResult {
  status: 'ok' | 'error'
  db: 'connected' | 'disconnected'
  meilisearch: 'connected' | 'disconnected'
  mollie?: 'connected' | 'disconnected' | 'skipped'
  brevo?: 'connected' | 'disconnected' | 'skipped'
  imgproxy?: 'connected' | 'disconnected' | 'skipped'
  s3?: 'connected' | 'disconnected' | 'skipped'
  emailOutboxBacklog?: number
  disk?: { healthy: boolean; availableBytes: number; totalBytes: number }
  pool?: {
    total: number
    idle: number
    waiting: number
  }
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

async function checkImgproxy(): Promise<'connected' | 'disconnected' | 'skipped'> {
  const url = process.env.IMGPROXY_HEALTH_URL
  if (url === '') {
    return 'skipped'
  }
  const healthUrl = url || 'http://imgproxy:8080/health'
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const response = await fetch(healthUrl, { signal: controller.signal })
    clearTimeout(timeout)
    return response.ok ? 'connected' : 'disconnected'
  } catch {
    return 'disconnected'
  }
}

async function checkS3(): Promise<'connected' | 'disconnected' | 'skipped'> {
  const endpoint = process.env.S3_ENDPOINT
  const bucket = process.env.S3_BUCKET
  const region = process.env.S3_REGION
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY

  if (!endpoint || !bucket || !region || !accessKeyId || !secretAccessKey) {
    return 'skipped'
  }

  try {
    const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3')
    const client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
    })
    await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }))
    return 'connected'
  } catch {
    return 'disconnected'
  }
}

async function checkEmailOutboxBacklog(): Promise<number> {
  try {
    const fiveMinutesAgo = sql`now() - interval '5 minutes'`
    const [row] = await db
      .select({ count: sql`count(*)` })
      .from(emailOutbox)
      .where(
        and(
          inArray(emailOutbox.status, ['pending', 'sending']),
          lt(emailOutbox.createdAt, fiveMinutesAgo),
        ),
      )
    return Number(row?.count ?? 0)
  } catch {
    return 0
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
      healthy: availableBytes > getHealthDiskThresholdBytes(),
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
  imgproxyStatus: 'connected' | 'disconnected' | 'skipped'
  s3Status: 'connected' | 'disconnected' | 'skipped'
  outboxBacklog: number
}> {
  const [mollieStatus, brevoStatus, imgproxyStatus, s3Status, outboxBacklog] = await Promise.all([
    checkMollie(),
    checkBrevo(),
    checkImgproxy(),
    checkS3(),
    checkEmailOutboxBacklog(),
  ])

  healthMollieConnected.set(mollieStatus === 'connected' || mollieStatus === 'skipped' ? 1 : 0)
  healthBrevoConnected.set(brevoStatus === 'connected' || brevoStatus === 'skipped' ? 1 : 0)
  healthImgproxyConnected.set(
    imgproxyStatus === 'connected' || imgproxyStatus === 'skipped' ? 1 : 0,
  )
  healthS3Connected.set(s3Status === 'connected' || s3Status === 'skipped' ? 1 : 0)
  emailOutboxBacklog.set(outboxBacklog)

  return { mollieStatus, brevoStatus, imgproxyStatus, s3Status, outboxBacklog }
}

function buildResult(
  dbHealthy: boolean,
  meilisearchHealthy: boolean,
  mollieStatus: 'connected' | 'disconnected' | 'skipped' | undefined,
  brevoStatus: 'connected' | 'disconnected' | 'skipped' | undefined,
  imgproxyStatus: 'connected' | 'disconnected' | 'skipped' | undefined,
  s3Status: 'connected' | 'disconnected' | 'skipped' | undefined,
  outboxBacklog: number | undefined,
  diskStatus: { healthy: boolean; availableBytes: number; totalBytes: number },
): HealthCheckResult {
  const criticalHealthy = dbHealthy && diskStatus.healthy
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
  if (imgproxyStatus !== undefined) {
    result.imgproxy = imgproxyStatus
  }
  if (s3Status !== undefined) {
    result.s3 = s3Status
  }
  if (outboxBacklog !== undefined) {
    result.emailOutboxBacklog = outboxBacklog
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
  const criticalHealthy = dbHealthy && diskStatus.healthy
  const body = buildResult(
    dbHealthy,
    meilisearchHealthy,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    diskStatus,
  )
  return { body, status: criticalHealthy ? 200 : 503 }
}

/**
 * Readiness probe — 200 only if critical dependencies (database and disk) are up.
 */
export async function checkReady(): Promise<{
  body: HealthCheckResult
  status: number
}> {
  const { dbHealthy, meilisearchHealthy, diskStatus } = await runCriticalChecks()
  const criticalHealthy = dbHealthy && diskStatus.healthy
  const body = buildResult(
    dbHealthy,
    meilisearchHealthy,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    diskStatus,
  )
  return { body, status: criticalHealthy ? 200 : 503 }
}

/**
 * Dependency probe — reports external provider status (Mollie, Brevo, imgproxy,
 * S3) and email outbox backlog without impacting readiness decisions.
 */
export async function checkDependencies(): Promise<{
  body: HealthCheckResult
  status: number
}> {
  const { dbHealthy, meilisearchHealthy, diskStatus } = await runCriticalChecks()
  const { mollieStatus, brevoStatus, imgproxyStatus, s3Status, outboxBacklog } =
    await runDependencyChecks()
  const depsHealthy =
    (mollieStatus === 'connected' || mollieStatus === 'skipped') &&
    (brevoStatus === 'connected' || brevoStatus === 'skipped') &&
    (imgproxyStatus === 'connected' || imgproxyStatus === 'skipped') &&
    (s3Status === 'connected' || s3Status === 'skipped')
  const body = buildResult(
    dbHealthy,
    meilisearchHealthy,
    mollieStatus,
    brevoStatus,
    imgproxyStatus,
    s3Status,
    outboxBacklog,
    diskStatus,
  )
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
