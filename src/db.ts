import '@tanstack/react-start/server-only'

import { Pool } from 'pg'

import { buildPoolConfig } from '#/lib/db-pool-config'

const poolConfig = buildPoolConfig(process.env)

export const pool = new Pool(poolConfig)

/* -------------------------------------------------------------------------- */
/*  Resilience: idle-connection errors must not crash the process.            */
/* -------------------------------------------------------------------------- */

pool.on('error', (err) => {
  const logLine = JSON.stringify({
    ts: new Date().toISOString(),
    level: 'error',
    msg: 'PostgreSQL pool error (idle connection)',
    error: err.message,
    stack: err.stack,
    service: 'eurtisan-app',
  })
  console.error(logLine)
})

/* -------------------------------------------------------------------------- */
/*  Graceful shutdown                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Drain the connection pool with an optional timeout.
 * Resolves when the pool is closed; rejects on timeout or error.
 */
export async function shutdownPool(timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Database pool shutdown timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    pool
      .end()
      .then(() => {
        clearTimeout(timer)
        resolve()
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

// Expose shutdown to the production server entry point via a well-known global.
// server-entry.mjs cannot import TypeScript / bundled modules directly.
const g = globalThis as typeof globalThis & {
  __eurtisan_shutdown_pool__?: () => Promise<void>
}
g.__eurtisan_shutdown_pool__ = shutdownPool

/* -------------------------------------------------------------------------- */
/*  Observability: pool saturation metrics                                     */
/* -------------------------------------------------------------------------- */

export interface PoolStats {
  total: number
  idle: number
  waiting: number
}

/**
 * Return current pool saturation metrics.
 * Useful for health checks and load-shedding decisions.
 */
export function getPoolStats(): PoolStats {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  }
}
