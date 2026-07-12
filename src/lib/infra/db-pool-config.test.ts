import { describe, expect, it } from 'vitest'

import { buildPoolConfig, parsePoolInt } from './db-pool-config'

describe('parsePoolInt', () => {
  it('returns fallback for undefined', () => {
    expect(parsePoolInt(undefined, 10)).toBe(10)
  })

  it('returns fallback for empty string', () => {
    expect(parsePoolInt('', 10)).toBe(10)
  })

  it('parses valid integer', () => {
    expect(parsePoolInt('25', 10)).toBe(25)
  })

  it('returns fallback for invalid string', () => {
    expect(parsePoolInt('not-a-number', 10)).toBe(10)
  })
})

describe('buildPoolConfig', () => {
  it('uses sensible defaults', () => {
    const config = buildPoolConfig({ DATABASE_URL: 'postgres://test' })
    expect(config).toEqual({
      connectionString: 'postgres://test',
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle: false,
    })
  })

  it('reads all environment overrides', () => {
    const config = buildPoolConfig({
      DATABASE_URL: 'postgres://prod',
      DATABASE_POOL_MAX: '5',
      DATABASE_POOL_IDLE_TIMEOUT_MS: '1000',
      DATABASE_POOL_CONNECTION_TIMEOUT_MS: '2000',
    })
    expect(config).toEqual({
      connectionString: 'postgres://prod',
      max: 5,
      idleTimeoutMillis: 1_000,
      connectionTimeoutMillis: 2_000,
      allowExitOnIdle: false,
    })
  })
})
