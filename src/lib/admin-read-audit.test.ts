import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import {
  auditLog,
  orderItem,
  payout,
  platformOrder,
  product,
  shop,
  shopOrder,
  user,
} from '#/db/schema'

import { listAllPlatformOrdersQuery } from './admin-orders.server'
import { listUsersQuery } from './admin-users.server'
import { emitAdminReadAudit } from './audit-log.server'
import { listPendingPayoutsQuery } from './payouts.server'

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

beforeEach(async () => {
  await db.delete(auditLog)
  await db.delete(payout)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(product)
  await db.delete(shop)
  await db.delete(user)
})

async function seedAdmin(overrides?: Partial<typeof user.$inferInsert>) {
  const [u] = await db
    .insert(user)
    .values({
      id: crypto.randomUUID(),
      name: 'Admin User',
      email: 'admin@example.com',
      emailVerified: true,
      role: 'admin',
      twoFactorEnabled: true,
      ...overrides,
    })
    .returning()
  return u
}

async function seedCustomer(overrides?: Partial<typeof user.$inferInsert>) {
  const [u] = await db
    .insert(user)
    .values({
      id: crypto.randomUUID(),
      name: 'Customer User',
      email: 'customer@example.com',
      emailVerified: true,
      role: 'customer',
      ...overrides,
    })
    .returning()
  return u
}

async function seedShop(overrides?: Partial<typeof shop.$inferInsert>) {
  const [s] = await db
    .insert(shop)
    .values({
      id: crypto.randomUUID(),
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: '00000000-0000-0000-0000-000000000000',
      ...overrides,
    })
    .returning()
  return s
}

function safeAdmin(actor: typeof user.$inferSelect): {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: 'admin'
  bannedAt: Date | null
  deletedAt: Date | null
  twoFactorEnabled: boolean
} {
  return {
    id: actor.id,
    name: actor.name,
    email: actor.email,
    emailVerified: actor.emailVerified,
    image: actor.image,
    role: actor.role as 'admin',
    bannedAt: actor.bannedAt,
    deletedAt: actor.deletedAt,
    twoFactorEnabled: actor.twoFactorEnabled ?? false,
  }
}

/* -------------------------------------------------------------------------- */
/*                        Integration: query + audit                          */
/* -------------------------------------------------------------------------- */

describe('admin read audit integration', () => {
  it('listUsers logs admin.read.user when an admin queries users', async () => {
    const admin = await seedAdmin()
    await seedCustomer({ name: 'Alice', email: 'alice@example.com' })
    await seedCustomer({ name: 'Bob', email: 'bob@example.com' })

    const result = await listUsersQuery({ page: 1, pageSize: 10, query: 'Alice' })
    await emitAdminReadAudit(safeAdmin(admin), 'admin.read.user', 'user', undefined, {
      query: 'Alice',
      page: 1,
      pageSize: 10,
      total: result.total,
    })

    const rows = await db.select().from(auditLog)
    expect(rows.length).toBe(1)
    expect(rows[0].action).toBe('admin.read.user')
    expect(rows[0].resourceType).toBe('user')
    expect(rows[0].actorId).toBe(admin.id)
    expect(rows[0].metadata).toEqual({
      query: 'Alice',
      page: 1,
      pageSize: 10,
      total: result.total,
    })
  })

  it('listAllPlatformOrders logs admin.read.order when an admin queries orders', async () => {
    const admin = await seedAdmin()
    const customer = await seedCustomer({ name: 'Buyer', email: 'buyer@example.com' })
    await db.insert(platformOrder).values({
      userId: customer.id,
      shippingAddress: {
        name: 'Buyer',
        street: '123 Main St',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
      },
      billingAddress: {
        name: 'Buyer',
        street: '123 Main St',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
      },
      totalCents: 2500,
      status: 'paid',
    })

    const result = await listAllPlatformOrdersQuery(undefined, 1, 20)
    await emitAdminReadAudit(safeAdmin(admin), 'admin.read.order', 'order', undefined, {
      page: 1,
      pageSize: 20,
      total: result.total,
    })

    const rows = await db.select().from(auditLog)
    expect(rows.length).toBe(1)
    expect(rows[0].action).toBe('admin.read.order')
    expect(rows[0].resourceType).toBe('order')
    expect(rows[0].actorId).toBe(admin.id)
    expect(rows[0].metadata).toEqual({
      page: 1,
      pageSize: 20,
      total: result.total,
    })
  })

  it('listPendingPayouts logs admin.read.payout when an admin queries payouts', async () => {
    const admin = await seedAdmin()
    const creator = await seedCustomer({ name: 'Creator', email: 'creator@example.com' })
    const s = await seedShop({ ownerId: creator.id, slug: 'creator-shop' })
    await db.insert(payout).values({
      shopId: s.id,
      amountCents: 5000,
      status: 'pending',
    })

    const result = await listPendingPayoutsQuery(1, 20)
    await emitAdminReadAudit(safeAdmin(admin), 'admin.read.payout', 'payout', undefined, {
      page: 1,
      pageSize: 20,
      total: result.total,
    })

    const rows = await db.select().from(auditLog)
    expect(rows.length).toBe(1)
    expect(rows[0].action).toBe('admin.read.payout')
    expect(rows[0].resourceType).toBe('payout')
    expect(rows[0].actorId).toBe(admin.id)
    expect(rows[0].metadata).toEqual({
      page: 1,
      pageSize: 20,
      total: result.total,
    })
  })

  it('does not log when the caller is a customer', async () => {
    const customer = await seedCustomer()

    await listUsersQuery({ page: 1, pageSize: 10 })
    await emitAdminReadAudit(
      {
        ...safeAdmin(customer),
        role: 'customer',
      },
      'admin.read.user',
      'user',
    )

    const rows = await db.select().from(auditLog)
    expect(rows.length).toBe(0)
  })
})
