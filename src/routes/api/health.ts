import { createFileRoute } from '@tanstack/react-router'

import { getPoolStats, pool } from '#/db.ts'

export interface HealthCheckResult {
  status: 'ok' | 'error'
  db: 'connected' | 'disconnected'
  pool?: {
    total: number
    idle: number
    waiting: number
  }
}

/**
 * Check database connectivity by running a lightweight query.
 */
export async function checkHealth(): Promise<{
  body: HealthCheckResult
  status: number
}> {
  try {
    await pool.query('SELECT 1')
    return {
      body: {
        status: 'ok',
        db: 'connected',
        pool: getPoolStats(),
      },
      status: 200,
    }
  } catch {
    return {
      body: {
        status: 'error',
        db: 'disconnected',
      },
      status: 503,
    }
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
