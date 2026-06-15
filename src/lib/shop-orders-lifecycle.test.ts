import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import {
  inventoryReservation,
  orderItem,
  payout,
  platformOrder,
  product,
  shop,
  shopOrder,
  user,
} from '#/db/schema'
import {
  cancelShopOrderQuery,
  resolveManualReviewQuery,
  updateShopOrderTrackingQuery,
  markShopOrderDeliveredQuery,
} from './shop-orders.server'

beforeEach(async () => {
  await db.delete(payout)
  await db.delete(inventoryReservation)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(product)
  await db.delete(shop)
  await db.delete(user)
})

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  return db
    .insert(user)
    .values({
      id: 'user-1',
      name: 'Test',
      email: 'test@example.com',
      emailVerified: true,
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedShop(overrides?: Partial<typeof shop.$inferInsert>) {
  return db
    .insert(shop)
    .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: 'user-1', ...overrides })
    .returning()
    .then((rows) => rows[0])
}

async function seedProduct(overrides?: Partial<typeof product.$inferInsert>) {
  return db
    .insert(product)
    .values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 1000,
      stockCount: 10,
      shopId: 'shop-1',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedPaidOrder(status: typeof shopOrder.$inferSelect.status = 'pending_payment') {
  await seedUser()
  await seedShop()

  const [platformOrd] = await db
    .insert(platformOrder)
    .values({
      userId: 'user-1',
      shippingAddress: {
        name: 'Buyer',
        street: 'St',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
      },
      billingAddress: {
        name: 'Buyer',
        street: 'St',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
      },
      totalCents: 1000,
      status: 'pending_payment',
    })
    .returning()

  const [so] = await db
    .insert(shopOrder)
    .values({
      platformOrderId: platformOrd.id,
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 0,
      subtotalCents: 1000,
      status,
    })
    .returning()

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
    await seedProduct()
    await db.insert(orderItem).values({
      shopOrderId: so.id,
      productId: 'prod-1',
      productName: 'Vase',
      unitPriceCents: 1000,
      quantity: 1,
      totalCents: 1000,
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
    })

    const updated = await resolveManualReviewQuery(so.id, { resolution: 'paid' })
    expect(updated.status).toBe('paid')

    const [productRecord] = await db.select().from(product).where(eq(product.id, 'prod-1'))
    expect(productRecord?.stockCount).toBe(9)
  })

  it('resolves manual_review to cancelled and restocks', async () => {
    const { shopOrder: so } = await seedPaidOrder('manual_review')
    await seedProduct()
    await db.insert(orderItem).values({
      shopOrderId: so.id,
      productId: 'prod-1',
      productName: 'Vase',
      unitPriceCents: 1000,
      quantity: 1,
      totalCents: 1000,
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
    })

    const updated = await resolveManualReviewQuery(so.id, { resolution: 'cancelled' })
    expect(updated.status).toBe('cancelled')

    const [productRecord] = await db.select().from(product).where(eq(product.id, 'prod-1'))
    expect(productRecord?.stockCount).toBe(11)
  })
})

describe('markShopOrderDeliveredQuery dispute window', () => {
  it('sets a future dispute window and creates a pending payout without executing it', async () => {
    await seedUser()
    await seedShop({ mollieAccountId: 'org_test', paymentConnected: true })
    const [platformOrd] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Buyer',
          street: 'St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        billingAddress: {
          name: 'Buyer',
          street: 'St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'paid',
        molliePaymentId: 'tr_test',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: platformOrd.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 0,
        subtotalCents: 1000,
        status: 'shipped',
      })
      .returning()

    await markShopOrderDeliveredQuery(so.id)

    const [record] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    expect(record?.status).toBe('delivered')
    expect(record?.disputeWindowExpiresAt).toBeInstanceOf(Date)
    expect(record?.disputeWindowExpiresAt?.getTime() ?? 0).toBeGreaterThan(Date.now())

    const [payoutRecord] = await db.select().from(payout).where(eq(payout.shopOrderId, so.id))
    expect(payoutRecord?.status).toBe('pending')
  })
})
