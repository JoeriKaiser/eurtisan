import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { payout, shop, shopOrder } from '#/db/schema'
import {
  clearMockRouteFailure,
  resetMockRouteCounter,
  setMockRouteFailure,
} from '#/integrations/mollie'
import { clearTestTables } from '#/test/cleanup'
import { createPlatformOrder, createShop, createShopOrder, createUser } from '#/test/factories'
import {
  assertPayoutReleaseAllowed,
  executePayoutQuery,
  isValidPayoutTransition,
  listCreatorPayoutsQuery,
  markPayoutSentQuery,
  PayoutError,
  reversePayoutForRefund,
} from './payouts.server'
import { PLATFORM_FEE_PERCENT } from './platform-constants'
import { markShopOrderDeliveredQuery, updateShopOrderStatusQuery } from './shop-orders.server'

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

beforeEach(async () => {
  await clearTestTables()
})

afterAll(async () => {
  await clearTestTables()
})

async function seedUser(overrides?: Parameters<typeof createUser>[0]) {
  return createUser({
    id: 'user-1',
    name: 'Test Creator',
    email: 'creator@example.com',
    ...overrides,
  })
}

async function seedShop(overrides?: Parameters<typeof createShop>[1]) {
  return createShop('user-1', {
    id: 'shop-1',
    name: 'Test Shop',
    slug: 'test-shop',
    mollieAccountId: 'org_test',
    paymentConnected: true,
    ...overrides,
  })
}

async function seedPlatformOrder(overrides?: Parameters<typeof createPlatformOrder>[1]) {
  return createPlatformOrder('user-1', {
    totalCents: 10000,
    status: 'paid',
    molliePaymentId: 'tr_test',
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
    ...overrides,
  })
}

async function seedShopOrder(overrides: NonNullable<Parameters<typeof createShopOrder>[2]>) {
  return createShopOrder({ id: '00000000-0000-0000-0000-000000000000' }, 'shop-1', {
    shippingMethod: 'standard',
    shippingCostCents: 500,
    subtotalCents: 5000,
    status: 'paid',
    ...overrides,
  })
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

describe('shop suspension propagation', () => {
  beforeEach(() => {
    resetMockRouteCounter()
    clearMockRouteFailure()
  })

  async function seedSuspendedShopWithHeldPayout() {
    await seedUser()
    await seedShop({ isSuspended: true })
    const platformOrd = await seedPlatformOrder()
    const order = await seedShopOrder({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      subtotalCents: 5000,
      status: 'shipped',
    })
    await markShopOrderDeliveredQuery(order.id)
    await expireDisputeWindow(order.id)
    const [payoutRecord] = await db.select().from(payout).where(eq(payout.shopOrderId, order.id))
    return { order, payoutRecord }
  }

  it('keeps a suspended shop delivered-order payout born-held pending', async () => {
    const { order, payoutRecord } = await seedSuspendedShopWithHeldPayout()

    const [orderRow] = await db.select().from(shopOrder).where(eq(shopOrder.id, order.id))
    expect(orderRow?.status).toBe('delivered')

    expect(payoutRecord).toBeDefined()
    expect(payoutRecord?.status).toBe('pending')
    expect(payoutRecord?.mollieRouteId).toBeNull()
    expect(payoutRecord?.executedAt).toBeNull()
  })

  it('blocks executePayoutQuery for a suspended shop without touching the payout', async () => {
    const { payoutRecord } = await seedSuspendedShopWithHeldPayout()

    let caught: unknown
    try {
      await executePayoutQuery(payoutRecord.id)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(Response)
    expect((caught as Response).status).toBe(409)
    const body = (await (caught as Response).json()) as { message?: string }
    expect(body.message).toContain('suspended')

    const [after] = await db.select().from(payout).where(eq(payout.id, payoutRecord.id))
    expect(after?.status).toBe('pending')
    expect(after?.executedAt).toBeNull()
    expect(after?.mollieRouteId).toBeNull()
    expect(after?.failureReason).toBeNull()
  })

  it('releases the held payout on the next natural transition after unsuspension', async () => {
    const { payoutRecord } = await seedSuspendedShopWithHeldPayout()
    await expect(executePayoutQuery(payoutRecord.id)).rejects.toBeInstanceOf(Response)

    await db.update(shop).set({ isSuspended: false }).where(eq(shop.id, 'shop-1'))

    const result = await executePayoutQuery(payoutRecord.id)
    expect(result.success).toBe(true)
    expect(result.routeId).toMatch(/^crt_mock_/)

    const [after] = await db.select().from(payout).where(eq(payout.id, payoutRecord.id))
    expect(after?.status).toBe('sent')
  })

  it('does not block refund clawbacks while the shop is suspended', async () => {
    const { payoutRecord } = await seedSuspendedShopWithHeldPayout()
    await db
      .update(payout)
      .set({
        status: 'sent',
        molliePaymentId: 'tr_test',
        mollieRouteId: 'crt_mock_1',
        sentAt: new Date(),
      })
      .where(eq(payout.id, payoutRecord.id))

    const options = await reversePayoutForRefund(db, payoutRecord.shopOrderId, 5000, 'buyer refund')

    expect(options.reverseRouting).toBe(true)
    const [after] = await db.select().from(payout).where(eq(payout.id, payoutRecord.id))
    expect(after?.status).toBe('reversed')
    expect(after?.reversalReason).toBe('buyer refund')
  })

  it('fails closed for unknown shops in the shared guard', async () => {
    await expect(
      assertPayoutReleaseAllowed(db, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(PayoutError)
  })

  it('allows active shops through the shared guard', async () => {
    await seedUser()
    await seedShop({ isSuspended: false })
    await expect(assertPayoutReleaseAllowed(db, 'shop-1')).resolves.toBeUndefined()
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

describe('isValidPayoutTransition', () => {
  it('allows pending -> in_transit', () => {
    expect(isValidPayoutTransition('pending', 'in_transit')).toBe(true)
  })

  it('allows in_transit -> sent', () => {
    expect(isValidPayoutTransition('in_transit', 'sent')).toBe(true)
  })

  it('allows sent -> reversed', () => {
    expect(isValidPayoutTransition('sent', 'reversed')).toBe(true)
  })

  it('disallows sent -> pending', () => {
    expect(isValidPayoutTransition('sent', 'pending')).toBe(false)
  })

  it('disallows reversed -> sent', () => {
    expect(isValidPayoutTransition('reversed', 'sent')).toBe(false)
  })
})

describe('PayoutError', () => {
  it('carries a code', () => {
    const err = new PayoutError('INVALID_STATUS_TRANSITION', 'bad transition')
    expect(err.code).toBe('INVALID_STATUS_TRANSITION')
    expect(err.message).toBe('bad transition')
  })
})
