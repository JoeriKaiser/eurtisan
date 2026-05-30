import { createFileRoute } from '@tanstack/react-router'

import { getPoolStats, pool } from '#/db.ts'
import { isMeilisearchHealthy } from '#/lib/meilisearch-products.server.ts'

export interface HealthCheckResult {
  status: 'ok' | 'error'
  db: 'connected' | 'disconnected'
  meilisearch: 'connected' | 'disconnected'
  pool?: {
    total: number
    idle: number
    waiting: number
  }
}

/**
 * Check database and Meilisearch connectivity.
 */
export async function checkHealth(): Promise<{
  body: HealthCheckResult
  status: number
}> {
  let dbHealthy = false
  try {
    await pool.query('SELECT 1')
    dbHealthy = true
  } catch {
    dbHealthy = false
  }

  const meilisearchHealthy = await isMeilisearchHealthy()

  if (dbHealthy && meilisearchHealthy) {
    return {
      body: {
        status: 'ok',
        db: 'connected',
        meilisearch: 'connected',
        pool: getPoolStats(),
      },
      status: 200,
    }
  }

  return {
    body: {
      status: 'error',
      db: dbHealthy ? 'connected' : 'disconnected',
      meilisearch: meilisearchHealthy ? 'connected' : 'disconnected',
    },
    status: 503,
  }
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
