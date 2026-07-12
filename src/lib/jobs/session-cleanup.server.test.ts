import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { session } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import { createSession, createUser } from '#/test/factories'

import { cleanupExpiredSessions } from './session-cleanup.server'

describe('cleanupExpiredSessions', () => {
  beforeEach(async () => {
    await clearTestTables()
  })

  afterAll(async () => {
    await clearTestTables()
  })

  it('deletes multiple expired sessions in a single batch via inArray', async () => {
    const user = await createUser()

    for (let i = 0; i < 3; i++) {
      await createSession(user, {
        expiresAt: new Date(Date.now() - 60_000),
      })
    }

    const result = await cleanupExpiredSessions(100)
    expect(result.deletedCount).toBe(3)

    const remaining = await db.select().from(session).where(eq(session.userId, user.id))

    expect(remaining).toHaveLength(0)
  })

  it('deletes a single expired session when only one row matches', async () => {
    const user = await createUser()

    await createSession(user, {
      expiresAt: new Date(Date.now() - 60_000),
    })

    const result = await cleanupExpiredSessions()
    expect(result.deletedCount).toBe(1)

    const remaining = await db.select().from(session).where(eq(session.userId, user.id))

    expect(remaining).toHaveLength(0)
  })

  it('returns zero when no expired sessions exist', async () => {
    const user = await createUser()

    await createSession(user, {
      expiresAt: new Date(Date.now() + 60_000),
    })

    const result = await cleanupExpiredSessions()
    expect(result.deletedCount).toBe(0)

    const remaining = await db.select().from(session).where(eq(session.userId, user.id))

    expect(remaining).toHaveLength(1)
  })
})
