import { beforeEach, describe, expect, it, vi } from 'vitest'
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
import {
  emitAdminReadAudit,
  emitAuditEvent,
  listAuditLogQuery,
  purgeOldAuditLogs,
} from './audit-log.server'

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
        deletedAt: null,
        twoFactorEnabled: true,
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

describe('emitAdminReadAudit', () => {
  async function adminActor(overrides?: Partial<typeof user.$inferInsert>): Promise<{
    id: string
    name: string
    email: string
    emailVerified: boolean
    image: null
    role: 'admin' | 'customer' | 'creator'
    bannedAt: null
    deletedAt: null
    twoFactorEnabled: boolean
  }> {
    const id = overrides?.id ?? crypto.randomUUID()
    await db.insert(user).values({
      id,
      name: overrides?.name ?? 'Admin',
      email: overrides?.email ?? `admin-${id.slice(0, 8)}@example.com`,
      emailVerified: overrides?.emailVerified ?? true,
      role: (overrides?.role as 'admin' | 'customer' | 'creator') ?? 'admin',
      twoFactorEnabled: true,
    })
    return {
      id,
      name: overrides?.name ?? 'Admin',
      email: overrides?.email ?? `admin-${id.slice(0, 8)}@example.com`,
      emailVerified: overrides?.emailVerified ?? true,
      image: null,
      role: (overrides?.role as 'admin' | 'customer' | 'creator') ?? 'admin',
      bannedAt: null,
      deletedAt: null,
      twoFactorEnabled: true,
    }
  }

  it('inserts an audit log entry for an admin actor', async () => {
    await emitAdminReadAudit(await adminActor(), 'admin.read.user', 'user', undefined, {
      page: 1,
      total: 5,
    })

    const rows = await db.select().from(auditLog)
    expect(rows.length).toBe(1)
    expect(rows[0].action).toBe('admin.read.user')
    expect(rows[0].resourceType).toBe('user')
    expect(rows[0].resourceId).toBeNull()
    expect(rows[0].metadata).toEqual({ page: 1, total: 5 })
  })

  it('no-ops when actor is null', async () => {
    await emitAdminReadAudit(null, 'admin.read.user', 'user')

    const rows = await db.select().from(auditLog)
    expect(rows.length).toBe(0)
  })

  it('no-ops when actor is not an admin', async () => {
    await emitAdminReadAudit(await adminActor({ role: 'customer' }), 'admin.read.user', 'user')

    const rows = await db.select().from(auditLog)
    expect(rows.length).toBe(0)
  })

  it('no-ops for creator role even when privileged', async () => {
    await emitAdminReadAudit(await adminActor({ role: 'creator' }), 'admin.read.order', 'order')

    const rows = await db.select().from(auditLog)
    expect(rows.length).toBe(0)
  })

  it('includes resourceId when provided', async () => {
    await emitAdminReadAudit(await adminActor(), 'admin.read.order', 'order', 'order-1')

    const rows = await db.select().from(auditLog)
    expect(rows.length).toBe(1)
    expect(rows[0].resourceId).toBe('order-1')
  })

  it('logs a structured fallback error log to console.error when DB insert fails', async () => {
    const actor = await adminActor()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const originalInsert = db.insert
    db.insert = vi.fn().mockImplementation(() => {
      throw new Error('Database connection lost')
    })

    try {
      await emitAdminReadAudit(actor, 'admin.read.user', 'user')

      expect(consoleErrorSpy).toHaveBeenCalled()
      const logOutput = consoleErrorSpy.mock.calls[0][0]
      const parsed = JSON.parse(logOutput)
      expect(parsed.level).toBe('error')
      expect(parsed.event).toBe('audit_emission_failed')
      expect(parsed.action).toBe('admin.read.user')
    } finally {
      db.insert = originalInsert
      consoleErrorSpy.mockRestore()
    }
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

describe('purgeOldAuditLogs', () => {
  beforeEach(async () => {
    await db.delete(auditLog)
    await db.delete(user)
  })

  async function seedUser() {
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
    return u
  }

  it('deletes audit logs older than the retention period', async () => {
    const u = await seedUser()

    await db.insert(auditLog).values({
      actorId: u.id,
      actorName: u.name,
      action: 'shop.suspend',
      resourceType: 'shop',
      createdAt: new Date(Date.now() - 366 * 24 * 60 * 60 * 1000),
    })

    const result = await purgeOldAuditLogs(365)
    expect(result.deletedCount).toBe(1)

    const remaining = await db.select().from(auditLog)
    expect(remaining).toHaveLength(0)
  })

  it('retains audit logs within the retention period', async () => {
    const u = await seedUser()

    await db.insert(auditLog).values({
      actorId: u.id,
      actorName: u.name,
      action: 'shop.suspend',
      resourceType: 'shop',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    })

    const result = await purgeOldAuditLogs(365)
    expect(result.deletedCount).toBe(0)

    const remaining = await db.select().from(auditLog)
    expect(remaining).toHaveLength(1)
  })

  it('returns zero when no audit logs exist', async () => {
    const result = await purgeOldAuditLogs(365)
    expect(result.deletedCount).toBe(0)
  })
})
