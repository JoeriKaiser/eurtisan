import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { verification } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import { createVerification } from '#/test/factories'

import { cleanupExpiredVerifications } from './verification-cleanup.server'

describe('cleanupExpiredVerifications', () => {
  beforeEach(async () => {
    await clearTestTables()
  })

  afterAll(async () => {
    await clearTestTables()
  })

  it('deletes multiple expired verifications in a single batch via inArray', async () => {
    for (let i = 0; i < 3; i++) {
      await createVerification({
        id: `ver-${i}`,
        identifier: `user-${i}@example.com`,
        value: `token-${i}`,
        expiresAt: new Date(Date.now() - 60_000),
      })
    }

    const result = await cleanupExpiredVerifications(100)
    expect(result.deletedCount).toBe(3)

    const remaining = await db.select().from(verification)
    expect(remaining).toHaveLength(0)
  })

  it('deletes a single expired verification when only one row matches', async () => {
    await createVerification({
      id: 'ver-1',
      identifier: 'user@example.com',
      value: 'token-1',
      expiresAt: new Date(Date.now() - 60_000),
    })

    const result = await cleanupExpiredVerifications()
    expect(result.deletedCount).toBe(1)

    const remaining = await db.select().from(verification)
    expect(remaining).toHaveLength(0)
  })

  it('returns zero when no expired verifications exist', async () => {
    await createVerification({
      id: 'ver-1',
      identifier: 'user@example.com',
      value: 'token-1',
      expiresAt: new Date(Date.now() + 60_000),
    })

    const result = await cleanupExpiredVerifications()
    expect(result.deletedCount).toBe(0)

    const remaining = await db.select().from(verification).where(eq(verification.id, 'ver-1'))
    expect(remaining).toHaveLength(1)
  })

  it('respects the batch size limit', async () => {
    for (let i = 0; i < 5; i++) {
      await createVerification({
        id: `ver-${i}`,
        identifier: `user-${i}@example.com`,
        value: `token-${i}`,
        expiresAt: new Date(Date.now() - 60_000),
      })
    }

    const result = await cleanupExpiredVerifications(2)
    expect(result.deletedCount).toBe(2)

    const remaining = await db.select().from(verification)
    expect(remaining).toHaveLength(3)
  })
})
