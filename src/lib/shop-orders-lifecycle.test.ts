import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { payout, platformOrder, product, shopOrder } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import {
  createOrderItem,
  createPlatformOrder,
  createProduct,
  createShop,
  createShopOrder,
  createUser,
} from '#/test/factories'
import {
  cancelShopOrderQuery,
  markShopOrderDeliveredQuery,
  resolveManualReviewQuery,
  updateShopOrderTrackingQuery,
} from './shop-orders.server'
import { isValidStatusTransition } from './order-status'

beforeEach(async () => {
  await clearTestTables()
})

afterAll(async () => {
  await clearTestTables()
})

async function seedPaidOrder(status: typeof shopOrder.$inferSelect.status = 'pending_payment') {
  const owner = await createUser({ role: 'creator' })
  const shop = await createShop(owner)
  const buyer = await createUser()
  const platformOrd = await createPlatformOrder(buyer, {
    status: 'pending_payment',
    totalCents: 1000,
  })
  const so = await createShopOrder(platformOrd, shop, {
    status,
    subtotalCents: 1000,
    shippingCostCents: 0,
  })

  return { platformOrder: platformOrd, shopOrder: so }
}

describe('cancelShopOrderQuery', () => {
  it('cancels an order in pending_payment and recalculates platform status', async () => {
    const { shopOrder: so } = await seedPaidOrder('pending_payment')

    const updated = await cancelShopOrderQuery(so.id)
    expect(updated.status).toBe('cancelled')

    const [platformRecord] = await db
      .select()
      .from(platformOrder)
      .where(eq(platformOrder.id, updated.platformOrderId))
    expect(platformRecord?.status).toBe('cancelled')
  })

  it('throws 400 when trying to cancel a shipped order', async () => {
    const { shopOrder: so } = await seedPaidOrder('shipped')

    await expect(cancelShopOrderQuery(so.id)).rejects.toBeInstanceOf(Response)
  })
})

describe('updateShopOrderTrackingQuery', () => {
  it('updates tracking info for a shipped order and appends history', async () => {
    const { shopOrder: so } = await seedPaidOrder('shipped')

    const updated = await updateShopOrderTrackingQuery(so.id, {
      trackingNumber: 'TRACK-NEW',
      trackingUrl: 'https://track.example.com/new',
    })

    expect(updated.trackingNumber).toBe('TRACK-NEW')
    expect(updated.trackingUrl).toBe('https://track.example.com/new')

    const [record] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    const history = record?.trackingHistory as Array<{
      updatedAt: string
      trackingNumber: string | null
      trackingUrl: string | null
    }>
    expect(history).toHaveLength(1)
    expect(history[0]?.trackingNumber).toBe('TRACK-NEW')
  })

  it('throws 400 when updating tracking for a non-shipped order', async () => {
    const { shopOrder: so } = await seedPaidOrder('paid')

    await expect(
      updateShopOrderTrackingQuery(so.id, { trackingNumber: 'TRACK-1' }),
    ).rejects.toBeInstanceOf(Response)
  })
})

describe('resolveManualReviewQuery', () => {
  it('resolves manual_review to paid', async () => {
    const { shopOrder: so, platformOrder: po } = await seedPaidOrder('manual_review')
    await db.update(platformOrder).set({ status: 'paid' }).where(eq(platformOrder.id, po.id))

    const owner = await createUser({ role: 'creator' })
    const shop = await createShop(owner)
    const prod = await createProduct(shop, {
      name: 'Vase',
      slug: 'vase',
      priceCents: 1000,
      stockCount: 10,
    })
    await createOrderItem(so, prod, {
      quantity: 1,
      unitPriceCents: 1000,
      totalCents: 1000,
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
    })

    const updated = await resolveManualReviewQuery(so.id, { resolution: 'paid' })
    expect(updated.status).toBe('paid')

    const [productRecord] = await db.select().from(product).where(eq(product.id, prod.id))
    expect(productRecord?.stockCount).toBe(9)
  })

  it('resolves manual_review to cancelled and restocks', async () => {
    const { shopOrder: so, platformOrder: po } = await seedPaidOrder('manual_review')
    await db
      .update(platformOrder)
      .set({ molliePaymentId: 'tr_mock_000001' })
      .where(eq(platformOrder.id, po.id))

    const owner = await createUser({ role: 'creator' })
    const shop = await createShop(owner)
    const prod = await createProduct(shop, {
      name: 'Vase',
      slug: 'vase',
      priceCents: 1000,
      stockCount: 10,
    })
    await createOrderItem(so, prod, {
      quantity: 1,
      unitPriceCents: 1000,
      totalCents: 1000,
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
    })

    const updated = await resolveManualReviewQuery(so.id, { resolution: 'cancelled' })
    expect(updated.status).toBe('cancelled')

    const [productRecord] = await db.select().from(product).where(eq(product.id, prod.id))
    expect(productRecord?.stockCount).toBe(11)
  })
})

describe('markShopOrderDeliveredQuery dispute window', () => {
  it('sets a future dispute window and creates a pending payout without executing it', async () => {
    const owner = await createUser({ role: 'creator' })
    const shop = await createShop(owner, {
      mollieAccountId: 'org_test',
      paymentConnected: true,
    })
    const buyer = await createUser()
    const platformOrd = await createPlatformOrder(buyer, {
      status: 'paid',
      totalCents: 1000,
      molliePaymentId: 'tr_test',
    })
    const so = await createShopOrder(platformOrd, shop, {
      status: 'shipped',
      subtotalCents: 1000,
      shippingCostCents: 0,
    })

    await markShopOrderDeliveredQuery(so.id)

    const [record] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    expect(record?.status).toBe('delivered')
    expect(record?.disputeWindowExpiresAt).toBeInstanceOf(Date)
    expect(record?.disputeWindowExpiresAt?.getTime() ?? 0).toBeGreaterThan(Date.now())

    const [payoutRecord] = await db.select().from(payout).where(eq(payout.shopOrderId, so.id))
    expect(payoutRecord?.status).toBe('pending')
  })
})

describe('isValidStatusTransition', () => {
  it('allows pending_payment -> paid', () => {
    expect(isValidStatusTransition('pending_payment', 'paid')).toBe(true)
  })

  it('allows paid -> shipped', () => {
    expect(isValidStatusTransition('paid', 'shipped')).toBe(true)
  })

  it('allows shipped -> delivered', () => {
    expect(isValidStatusTransition('shipped', 'delivered')).toBe(true)
  })

  it('disallows shipped -> pending_payment', () => {
    expect(isValidStatusTransition('shipped', 'pending_payment')).toBe(false)
  })

  it('disallows cancelled -> paid', () => {
    expect(isValidStatusTransition('cancelled', 'paid')).toBe(false)
  })
})
