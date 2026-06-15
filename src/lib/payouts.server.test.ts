import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { payout, platformOrder, shop, shopOrder, user } from '#/db/schema'
import { PLATFORM_FEE_PERCENT } from './platform-constants'
import { markShopOrderDeliveredQuery, updateShopOrderStatusQuery } from './shop-orders.server'
import { executePayoutQuery, markPayoutSentQuery, listCreatorPayoutsQuery } from './payouts.server'
import {
  clearMockRouteFailure,
  resetMockRouteCounter,
  setMockRouteFailure,
} from '#/integrations/mollie'

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
      mollieAccountId: 'org_test',
      paymentConnected: true,
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
      molliePaymentId: 'tr_test',
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

async function expireDisputeWindow(shopOrderId: string) {
  await db
    .update(shopOrder)
    .set({ disputeWindowExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) })
    .where(eq(shopOrder.id, shopOrderId))
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

  it('calculates the platform fee net of VAT and sets the correct payout amount', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    const subtotalCents = 12000
    const vatAmountCents = 2000
    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents,
      vatAmountCents,
      status: 'shipped',
    })

    await markShopOrderDeliveredQuery(order.id)

    const [payoutRecord] = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))

    expect(payoutRecord).toBeDefined()
    expect(payoutRecord?.status).toBe('pending')

    const expectedFee = Math.round((subtotalCents - vatAmountCents) * (PLATFORM_FEE_PERCENT / 100))
    expect(payoutRecord?.amountCents).toBe(subtotalCents - expectedFee)
  })

  it('includes shipping cost in the payout for manual shipping orders', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    const subtotalCents = 10000
    const shippingCostCents = 850
    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents,
      shippingCostCents,
      shippingMethod: 'manual',
      status: 'shipped',
    })

    await markShopOrderDeliveredQuery(order.id)

    const [payoutRecord] = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))
    expect(payoutRecord).toBeDefined()
    expect(payoutRecord?.status).toBe('pending')

    const expectedFee = Math.round(subtotalCents * (PLATFORM_FEE_PERCENT / 100))
    const expectedAmount = subtotalCents - expectedFee + shippingCostCents
    expect(payoutRecord?.amountCents).toBe(expectedAmount)
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
    await expireDisputeWindow(order.id)

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
    await expireDisputeWindow(order.id)

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
    await expireDisputeWindow(order.id)

    const [pending] = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))

    const results = await Promise.all([
      markPayoutSentQuery(pending.id),
      markPayoutSentQuery(pending.id),
      markPayoutSentQuery(pending.id),
    ])

    expect(results.every((r) => r.success)).toBe(true)

    const [updated] = await db.select().from(payout).where(eq(payout.id, pending.id))
    expect(updated?.status).toBe('sent')
  })
})

describe('executePayoutQuery', () => {
  beforeEach(() => {
    resetMockRouteCounter()
    clearMockRouteFailure()
  })

  it('creates a Mollie route and updates the payout to sent', async () => {
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
    await expireDisputeWindow(order.id)

    const [pending] = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))

    const result = await executePayoutQuery(pending.id)
    expect(result.success).toBe(true)
    expect(result.routeId).toMatch(/^crt_mock_/)

    const [updated] = await db.select().from(payout).where(eq(payout.id, pending.id))
    expect(updated?.status).toBe('sent')
    expect(updated?.mollieRouteId).toBe(result.routeId)
    expect(updated?.molliePaymentId).toBe('tr_test')
    expect(updated?.executedAt).toBeInstanceOf(Date)
  })

  it('is idempotent for already-sent payouts', async () => {
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
    await expireDisputeWindow(order.id)

    const [pending] = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))
    const first = await executePayoutQuery(pending.id)
    const second = await executePayoutQuery(pending.id)

    expect(first.routeId).toBe(second.routeId)

    const rows = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))
    expect(rows).toHaveLength(1)
  })

  it('fails when the platform order has no Mollie payment ID', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder({ molliePaymentId: null })
    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 5000,
      status: 'shipped',
    })
    await markShopOrderDeliveredQuery(order.id)
    await expireDisputeWindow(order.id)

    const [pending] = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))

    await expect(executePayoutQuery(pending.id)).rejects.toBeInstanceOf(Response)

    const [updated] = await db.select().from(payout).where(eq(payout.id, pending.id))
    expect(updated?.status).toBe('failed')
    expect(updated?.failureReason).toContain('no Mollie payment ID')
  })

  it('fails when the shop has no connected Mollie account', async () => {
    await seedUser()
    await seedShop({ mollieAccountId: null, paymentConnected: false })
    const platformOrd = await seedPlatformOrder()
    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 5000,
      status: 'shipped',
    })
    await markShopOrderDeliveredQuery(order.id)
    await expireDisputeWindow(order.id)

    const [pending] = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))

    await expect(executePayoutQuery(pending.id)).rejects.toBeInstanceOf(Response)

    const [updated] = await db.select().from(payout).where(eq(payout.id, pending.id))
    expect(updated?.status).toBe('failed')
    expect(updated?.failureReason).toContain('no connected Mollie account')
  })

  it('records a route_failed reconciliation log when Mollie returns an error', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()
    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 5000,
      status: 'delivered',
    })

    const [pending] = await db
      .insert(payout)
      .values({
        shopOrderId: order.id,
        shopId: 'shop-1',
        amountCents: 4500,
        status: 'pending',
      })
      .returning()

    setMockRouteFailure('Mollie API error')
    await expect(executePayoutQuery(pending.id)).rejects.toBeInstanceOf(Response)

    const [updated] = await db.select().from(payout).where(eq(payout.id, pending.id))
    expect(updated?.status).toBe('failed')
    expect(updated?.failureReason).toBe('Mollie API error')
  })
})

describe('listCreatorPayoutsQuery', () => {
  it('derives payout amounts net of VAT dynamically when no payout record exists', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    const subtotalCents = 15000
    const vatAmountCents = 3000
    // Seed order as 'delivered' so it is fetched for payouts, but delete/do not create the payout record.
    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents,
      vatAmountCents,
      status: 'delivered',
    })

    // Assert that we don't have a payout record yet
    const payoutsInDb = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))
    expect(payoutsInDb).toHaveLength(0)

    const result = await listCreatorPayoutsQuery('shop-1')
    expect(result.payouts).toHaveLength(1)
    const line = result.payouts[0]

    const expectedFee = Math.round((subtotalCents - vatAmountCents) * (PLATFORM_FEE_PERCENT / 100))
    expect(line.amountCents).toBe(subtotalCents - expectedFee)
  })

  it('uses the persisted payout amount from database when a payout record exists', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    const subtotalCents = 15000
    const vatAmountCents = 3000
    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents,
      vatAmountCents,
      status: 'shipped',
    })

    // Delivering the order creates a payout record
    await markShopOrderDeliveredQuery(order.id)

    // Check that payout record exists in DB
    const [payoutRecord] = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))
    expect(payoutRecord).toBeDefined()

    // Manually override/adjust the database payout amount to verify it is used instead of calculated dynamically
    await db.update(payout).set({ amountCents: 9999 }).where(eq(payout.id, payoutRecord.id))

    const result = await listCreatorPayoutsQuery('shop-1')
    expect(result.payouts).toHaveLength(1)
    const line = result.payouts[0]
    expect(line.amountCents).toBe(9999)
  })

  it('derives payout amounts dynamically including shipping cost for manual shipping orders when no payout record exists', async () => {
    await seedUser()
    await seedShop()
    const platformOrd = await seedPlatformOrder()

    const subtotalCents = 15000
    const vatAmountCents = 3000
    const shippingCostCents = 750
    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents,
      vatAmountCents,
      shippingCostCents,
      shippingMethod: 'manual',
      status: 'delivered',
    })

    const payoutsInDb = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))
    expect(payoutsInDb).toHaveLength(0)

    const result = await listCreatorPayoutsQuery('shop-1')
    expect(result.payouts).toHaveLength(1)
    const line = result.payouts[0]

    const expectedFee = Math.round((subtotalCents - vatAmountCents) * (PLATFORM_FEE_PERCENT / 100))
    const expectedAmount = subtotalCents - expectedFee + shippingCostCents
    expect(line.amountCents).toBe(expectedAmount)
  })
})
