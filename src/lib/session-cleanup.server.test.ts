import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { session, user } from '#/db/schema'

import { cleanupExpiredSessions } from './session-cleanup.server'

describe('cleanupExpiredSessions', () => {
  beforeEach(async () => {
    await db.delete(session)
    await db.delete(user)
  })

  async function seedUser() {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
      })
      .returning()

    return { user: u }
  }

  it('deletes multiple expired sessions in a single batch via inArray', async () => {
    const { user: u } = await seedUser()

    for (let i = 0; i < 3; i++) {
      await db.insert(session).values({
        id: `session-${i}`,
        token: `token-${i}`,
        userId: u.id,
        expiresAt: new Date(Date.now() - 60_000),
      })
    }

    const result = await cleanupExpiredSessions(100)
    expect(result.deletedCount).toBe(3)

    const remaining = await db.select().from(session).where(eq(session.userId, u.id))

    expect(remaining).toHaveLength(0)
  })

  it('deletes a single expired session when only one row matches', async () => {
    const { user: u } = await seedUser()

    await db.insert(session).values({
      id: 'session-1',
      token: 'token-1',
      userId: u.id,
      expiresAt: new Date(Date.now() - 60_000),
    })

    const result = await cleanupExpiredSessions()
    expect(result.deletedCount).toBe(1)

    const remaining = await db.select().from(session).where(eq(session.userId, u.id))

    expect(remaining).toHaveLength(0)
  })

  it('returns zero when no expired sessions exist', async () => {
    const { user: u } = await seedUser()

    await db.insert(session).values({
      id: 'session-1',
      token: 'token-1',
      userId: u.id,
      expiresAt: new Date(Date.now() + 60_000),
    })

    const result = await cleanupExpiredSessions()
    expect(result.deletedCount).toBe(0)

    const remaining = await db.select().from(session).where(eq(session.userId, u.id))

    expect(remaining).toHaveLength(1)
  })
})
