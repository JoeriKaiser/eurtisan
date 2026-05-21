import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import {
  auditLog,
  orderItem,
  platformOrder,
  product,
  review,
  shop,
  shopOrder,
  user,
} from '#/db/schema'
import { emitAuditEvent, listAuditLogQuery } from './audit-log.server'

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

describe('emitAuditEvent', () => {
  it('inserts an audit log entry', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: crypto.randomUUID(),
        name: 'Admin',
        email: 'admin@example.com',
        emailVerified: true,
        role: 'admin',
      })
      .returning()

    await emitAuditEvent(
      {
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: u.emailVerified,
        image: null,
        role: 'admin',
        bannedAt: null,
      },
      'shop.suspend',
      'shop',
      'shop-1',
      { reason: 'Violation' },
    )

    const rows = await db.select().from(auditLog)
    expect(rows.length).toBe(1)
    expect(rows[0].action).toBe('shop.suspend')
    expect(rows[0].resourceType).toBe('shop')
    expect(rows[0].resourceId).toBe('shop-1')
  })

  it('does not throw when actor is null', async () => {
    await expect(emitAuditEvent(null, 'shop.suspend', 'shop', 'shop-1')).resolves.toBeUndefined()

    const rows = await db.select().from(auditLog)
    expect(rows.length).toBe(0)
  })
})

describe('listAuditLogQuery', () => {
  async function seedEntry(
    actor: typeof user.$inferSelect,
    action: string,
    resourceType: string,
    resourceId?: string,
  ) {
    await db.insert(auditLog).values({
      actorId: actor.id,
      actorName: actor.name,
      action,
      resourceType,
      resourceId: resourceId ?? null,
      metadata: {},
    })
  }

  it('returns paginated entries', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: crypto.randomUUID(),
        name: 'Admin',
        email: 'admin@example.com',
        emailVerified: true,
        role: 'admin',
      })
      .returning()

    await seedEntry(u, 'shop.suspend', 'shop', 'shop-1')
    await seedEntry(u, 'user.ban', 'user', 'user-1')

    const result = await listAuditLogQuery({ page: 1, pageSize: 10 })
    expect(result.entries.length).toBe(2)
    expect(result.total).toBe(2)
  })

  it('filters by action', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: crypto.randomUUID(),
        name: 'Admin',
        email: 'admin@example.com',
        emailVerified: true,
        role: 'admin',
      })
      .returning()

    await seedEntry(u, 'shop.suspend', 'shop')
    await seedEntry(u, 'user.ban', 'user')

    const result = await listAuditLogQuery({ page: 1, pageSize: 10, action: 'shop.suspend' })
    expect(result.entries.length).toBe(1)
    expect(result.entries[0].action).toBe('shop.suspend')
  })

  it('filters by actorId', async () => {
    const [a] = await db
      .insert(user)
      .values({
        id: crypto.randomUUID(),
        name: 'Admin A',
        email: 'a@example.com',
        emailVerified: true,
        role: 'admin',
      })
      .returning()
    const [b] = await db
      .insert(user)
      .values({
        id: crypto.randomUUID(),
        name: 'Admin B',
        email: 'b@example.com',
        emailVerified: true,
        role: 'admin',
      })
      .returning()

    await seedEntry(a, 'shop.suspend', 'shop')
    await seedEntry(b, 'user.ban', 'user')

    const result = await listAuditLogQuery({ page: 1, pageSize: 10, actorId: a.id })
    expect(result.entries.length).toBe(1)
    expect(result.entries[0].actorId).toBe(a.id)
  })
})
