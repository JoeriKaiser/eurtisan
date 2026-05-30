/**
 * Database pool configuration — pure logic, no side effects.
 *
 * Separated from `src/db.ts` so the configuration parsing can be
 * unit-tested without instantiating a live `pg.Pool`.
 */

export function parsePoolInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

export interface PoolConfigEnv {
  DATABASE_URL?: string
  DATABASE_POOL_MAX?: string
  DATABASE_POOL_IDLE_TIMEOUT_MS?: string
  DATABASE_POOL_CONNECTION_TIMEOUT_MS?: string
}

export function buildPoolConfig(env: PoolConfigEnv) {
  return {
    connectionString: env.DATABASE_URL,
    max: parsePoolInt(env.DATABASE_POOL_MAX, 20),
    idleTimeoutMillis: parsePoolInt(env.DATABASE_POOL_IDLE_TIMEOUT_MS, 30_000),
    connectionTimeoutMillis: parsePoolInt(env.DATABASE_POOL_CONNECTION_TIMEOUT_MS, 5_000),
    allowExitOnIdle: false,
  }
}
