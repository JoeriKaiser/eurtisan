import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import {
  auditLog,
  orderItem,
  platformOrder,
  product,
  review,
  session,
  shop,
  shopOrder,
  user,
} from '#/db/schema'
import {
  banUserQuery,
  listUsersQuery,
  unbanUserQuery,
  updateUserRoleQuery,
} from './admin-users.server'

beforeEach(async () => {
  await db.delete(auditLog)
  await db.delete(review)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(product)
  await db.delete(shop)
  await db.delete(user)
})

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  const [u] = await db
    .insert(user)
    .values({
      id: crypto.randomUUID(),
      name: 'Test User',
      email: `test-${Date.now()}@example.com`,
      emailVerified: true,
      role: 'customer',
      ...overrides,
    })
    .returning()
  return u
}

describe('listUsersQuery', () => {
  it('returns paginated users', async () => {
    await seedUser({ name: 'Alice', email: 'alice@example.com' })
    await seedUser({ name: 'Bob', email: 'bob@example.com' })

    const result = await listUsersQuery({ page: 1, pageSize: 10 })
    expect(result.users.length).toBe(2)
    expect(result.total).toBe(2)
  })

  it('filters by role', async () => {
    await seedUser({ name: 'Alice', role: 'customer' })
    await seedUser({ name: 'Bob', role: 'admin' })

    const result = await listUsersQuery({ page: 1, pageSize: 10, role: 'admin' })
    expect(result.users.length).toBe(1)
    expect(result.users[0].name).toBe('Bob')
  })

  it('filters by banned status', async () => {
    await seedUser({ name: 'Alice', bannedAt: null })
    await seedUser({ name: 'Bob', bannedAt: new Date() })

    const active = await listUsersQuery({ page: 1, pageSize: 10, status: 'active' })
    expect(active.users.length).toBe(1)
    expect(active.users[0].name).toBe('Alice')

    const banned = await listUsersQuery({ page: 1, pageSize: 10, status: 'banned' })
    expect(banned.users.length).toBe(1)
    expect(banned.users[0].name).toBe('Bob')
  })

  it('searches by name', async () => {
    await seedUser({ name: 'Alice Smith', email: 'a@example.com' })
    await seedUser({ name: 'Bob Jones', email: 'b@example.com' })

    const result = await listUsersQuery({ page: 1, pageSize: 10, query: 'alice' })
    expect(result.users.length).toBe(1)
    expect(result.users[0].name).toBe('Alice Smith')
  })

  it('counts shops per user', async () => {
    const u = await seedUser({ name: 'Creator' })
    await db.insert(shop).values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: u.id,
    })

    const result = await listUsersQuery({ page: 1, pageSize: 10 })
    expect(result.users[0].shopCount).toBe(1)
  })
})

describe('updateUserRoleQuery', () => {
  it('updates user role', async () => {
    const u = await seedUser({ role: 'customer' })
    const result = await updateUserRoleQuery(u.id, 'creator')
    expect(result.role).toBe('creator')
  })

  it('throws for missing user', async () => {
    await expect(updateUserRoleQuery('nonexistent', 'admin')).rejects.toThrow('User not found')
  })

  it('revokes sessions on demotion', async () => {
    const u = await seedUser({ role: 'admin' })
    await db.insert(session).values({
      id: 'sess-1',
      token: 'token-1',
      expiresAt: new Date(Date.now() + 3600_000),
      userId: u.id,
    })

    await updateUserRoleQuery(u.id, 'customer')

    const sessions = await db.select().from(session).where(eq(session.userId, u.id))
    expect(sessions.length).toBe(0)
  })

  it('does not revoke sessions on promotion', async () => {
    const u = await seedUser({ role: 'customer' })
    await db.insert(session).values({
      id: 'sess-1',
      token: 'token-1',
      expiresAt: new Date(Date.now() + 3600_000),
      userId: u.id,
    })

    await updateUserRoleQuery(u.id, 'creator')

    const sessions = await db.select().from(session).where(eq(session.userId, u.id))
    expect(sessions.length).toBe(1)
  })
})

describe('banUserQuery', () => {
  it('sets bannedAt and banReason', async () => {
    const u = await seedUser()
    const result = await banUserQuery(u.id, 'Spam')
    expect(result.bannedAt).not.toBeNull()

    const [row] = await db.select().from(user).where(eq(user.id, u.id))
    expect(row.banReason).toBe('Spam')
  })

  it('throws for missing user', async () => {
    await expect(banUserQuery('nonexistent')).rejects.toThrow('User not found')
  })

  it('revokes all active sessions', async () => {
    const u = await seedUser()
    await db.insert(session).values({
      id: 'sess-1',
      token: 'token-1',
      expiresAt: new Date(Date.now() + 3600_000),
      userId: u.id,
    })

    await banUserQuery(u.id, 'Spam')

    const sessions = await db.select().from(session).where(eq(session.userId, u.id))
    expect(sessions.length).toBe(0)
  })
})

describe('unbanUserQuery', () => {
  it('clears bannedAt and banReason', async () => {
    const u = await seedUser({ bannedAt: new Date(), banReason: 'Spam' })
    const result = await unbanUserQuery(u.id)
    expect(result.bannedAt).toBeNull()

    const [row] = await db.select().from(user).where(eq(user.id, u.id))
    expect(row.banReason).toBeNull()
  })

  it('throws for missing user', async () => {
    await expect(unbanUserQuery('nonexistent')).rejects.toThrow('User not found')
  })
})
