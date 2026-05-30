import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { payout, platformOrder, shop, shopOrder, user } from '#/db/schema'
import { PLATFORM_FEE_PERCENT } from './platform-constants'
import { markShopOrderDeliveredQuery, updateShopOrderStatusQuery } from './shop-orders.server'
import { markPayoutSentQuery } from './payouts.server'

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

beforeEach(async () => {
  await db.delete(payout)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(shop)
  await db.delete(user)
})

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  return db
    .insert(user)
    .values({
      id: 'user-1',
      name: 'Test Creator',
      email: 'creator@example.com',
      emailVerified: true,
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedShop(overrides?: Partial<typeof shop.$inferInsert>) {
  return db
    .insert(shop)
    .values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: 'user-1',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedPlatformOrder(overrides?: Partial<typeof platformOrder.$inferInsert>) {
  return db
    .insert(platformOrder)
    .values({
      userId: 'user-1',
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
      totalCents: 10000,
      status: 'paid',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedShopOrder(overrides: Partial<typeof shopOrder.$inferInsert>) {
  return db
    .insert(shopOrder)
    .values({
      platformOrderId: '00000000-0000-0000-0000-000000000000',
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 5000,
      status: 'paid',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

/* -------------------------------------------------------------------------- */
/*                                 Tests                                      */
/* -------------------------------------------------------------------------- */

describe('createPayoutForShopOrder', () => {
  it('creates a pending payout when an order is marked as delivered', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    const subtotalCents = 10000
    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents,
      status: 'shipped',
    })

    await markShopOrderDeliveredQuery(order.id)

    const [payoutRecord] = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))

    expect(payoutRecord).toBeDefined()
    expect(payoutRecord?.status).toBe('pending')
    expect(payoutRecord?.shopId).toBe('shop-1')

    const expectedFee = Math.round(subtotalCents * (PLATFORM_FEE_PERCENT / 100))
    expect(payoutRecord?.amountCents).toBe(subtotalCents - expectedFee)
  })

  it('creates a pending payout when an order is transitioned to completed', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    const subtotalCents = 7500
    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents,
      status: 'delivered',
    })

    await updateShopOrderStatusQuery(order.id, { status: 'completed' })

    const [payoutRecord] = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))

    expect(payoutRecord).toBeDefined()
    expect(payoutRecord?.status).toBe('pending')

    const expectedFee = Math.round(subtotalCents * (PLATFORM_FEE_PERCENT / 100))
    expect(payoutRecord?.amountCents).toBe(subtotalCents - expectedFee)
  })

  it('creates a pending payout when an order is transitioned to delivered via updateShopOrderStatusQuery', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    const subtotalCents = 5000
    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents,
      status: 'shipped',
    })

    await updateShopOrderStatusQuery(order.id, { status: 'delivered' })

    const [payoutRecord] = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))

    expect(payoutRecord).toBeDefined()
    expect(payoutRecord?.status).toBe('pending')

    const expectedFee = Math.round(subtotalCents * (PLATFORM_FEE_PERCENT / 100))
    expect(payoutRecord?.amountCents).toBe(subtotalCents - expectedFee)
  })

  it('is idempotent — duplicate transitions do not create multiple payouts', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 5000,
      status: 'shipped',
    })

    await markShopOrderDeliveredQuery(order.id)
    await markShopOrderDeliveredQuery(order.id)

    const payouts = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))

    expect(payouts).toHaveLength(1)
  })
})

describe('markPayoutSentQuery', () => {
  it('throws 404 for non-existent payout', async () => {
    await expect(
      markPayoutSentQuery('00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(Response)
  })

  it('marks a pending payout as sent', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()
    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 5000,
      status: 'shipped',
    })
    await markShopOrderDeliveredQuery(order.id)

    const [pending] = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))

    const result = await markPayoutSentQuery(pending.id)
    expect(result.success).toBe(true)

    const [updated] = await db.select().from(payout).where(eq(payout.id, pending.id))
    expect(updated?.status).toBe('sent')
    expect(updated?.sentAt).toBeInstanceOf(Date)
  })

  it('returns success when payout is already sent', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()
    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 5000,
      status: 'shipped',
    })
    await markShopOrderDeliveredQuery(order.id)

    const [pending] = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))
    await markPayoutSentQuery(pending.id)

    const result = await markPayoutSentQuery(pending.id)
    expect(result.success).toBe(true)

    const rows = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.status).toBe('sent')
  })

  it('handles concurrent calls without double-update', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()
    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 5000,
      status: 'shipped',
    })
    await markShopOrderDeliveredQuery(order.id)

    const [pending] = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))

    const results = await Promise.all([
      markPayoutSentQuery(pending.id),
      markPayoutSentQuery(pending.id),
      markPayoutSentQuery(pending.id),
    ])

    expect(results.every((r) => r.success)).toBe(true)

    const [updated] = await db.select().from(payout).where(eq(payout.id, pending.id))
    expect(updated?.status).toBe('sent')
    expect(updated?.sentAt).toBeInstanceOf(Date)
  })
})
