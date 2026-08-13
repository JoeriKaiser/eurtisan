import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'

import { withJobLock } from './job-lock.server'

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://eurtisan:eurtisan@db:5432/eurtisan'

describe('withJobLock', () => {
  let client: Client

  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL })
    await client.connect()
  })

  afterAll(async () => {
    await client.end()
  })

  it('runs the callback and returns its result when the lock is free', async () => {
    const result = await withJobLock('inventory-cleanup', async () => 'ok')
    expect(result).toBe('ok')
  })

  it('returns undefined when the same lock is already held', async () => {
    // Hold the lock on a dedicated connection for the duration of the test.
    const holder = new Client({ connectionString: DATABASE_URL })
    await holder.connect()
    await holder.query('SELECT pg_advisory_lock(1001)')

    try {
      const result = await withJobLock('inventory-cleanup', async () => 'ran')
      expect(result).toBeUndefined()
    } finally {
      await holder.query('SELECT pg_advisory_unlock(1001)')
      await holder.end()
    }
  })

  it('prevents overlapping financial reconciliation runs', async () => {
    const holder = new Client({ connectionString: DATABASE_URL })
    await holder.connect()
    await holder.query('SELECT pg_advisory_lock(1015)')

    try {
      const result = await withJobLock('financial-totals-reconciliation', async () => 'ran')
      expect(result).toBeUndefined()
    } finally {
      await holder.query('SELECT pg_advisory_unlock(1015)')
      await holder.end()
    }
  })

  it('releases the lock after the callback throws so a second attempt can succeed', async () => {
    await expect(
      withJobLock('session-cleanup', async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    const result = await withJobLock('session-cleanup', async () => 'recovered')
    expect(result).toBe('recovered')
  })
})
