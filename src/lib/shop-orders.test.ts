import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { orderItem, platformOrder, product, shop, shopOrder, user } from '#/db/schema'

import {
  createShippingLabelForOrderQuery,
  derivePlatformStatus,
  getShopOrderDetailQuery,
  getShopOrderQuery,
  isValidStatusTransition,
  listShopOrdersQuery,
  markShopOrderDeliveredQuery,
  markShopOrderShippedQuery,
  markShopOrderShippedWithLabelQuery,
  recalcPlatformOrderStatus,
  updateShopOrderStatusQuery,
} from './shop-orders.server'

beforeEach(async () => {
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

describe('getShopOrderDetailQuery', () => {
  it('returns null for nonexistent order', async () => {
    const result = await getShopOrderDetailQuery('550e8400-e29b-41d4-a716-446655440000')
    expect(result).toBeNull()
  })

  it('masks buyer email in the response', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test Buyer',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test Buyer',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'paid',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'paid',
      })
      .returning()

    const result = await getShopOrderDetailQuery(so.id)
    expect(result).not.toBeNull()
    expect(result?.buyer.email).toBe('t***@example.com')
    expect(result?.buyer.name).toBe('Test')
  })

  it('returns full order detail with items and shipping address', async () => {
    await seedUser()
    await seedShop()
    const p = await seedProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test Buyer',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test Buyer',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        totalCents: 2500,
        status: 'paid',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 2000,
        status: 'paid',
      })
      .returning()

    await db.insert(orderItem).values({
      shopOrderId: so.id,
      productId: p.id,
      productName: p.name,
      unitPriceCents: p.priceCents,
      quantity: 2,
      totalCents: 2000,
    })

    const result = await getShopOrderDetailQuery(so.id)
    expect(result?.items).toHaveLength(1)
    expect(result?.items[0].productName).toBe('Vase')
    expect(result?.shippingAddress.city).toBe('Berlin')
  })
})

describe('getShopOrderQuery', () => {
  it('returns null for nonexistent order', async () => {
    const result = await getShopOrderQuery('550e8400-e29b-41d4-a716-446655440000')
    expect(result).toBeNull()
  })

  it('returns shop order with items, buyer and shipping address', async () => {
    await seedUser()
    await seedShop()
    const p = await seedProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test Buyer',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test Buyer',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        totalCents: 2500,
        status: 'paid',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 2000,
        status: 'paid',
      })
      .returning()

    await db.insert(orderItem).values({
      shopOrderId: so.id,
      productId: p.id,
      productName: p.name,
      unitPriceCents: p.priceCents,
      quantity: 2,
      totalCents: 2000,
    })

    const result = await getShopOrderQuery(so.id)
    expect(result).not.toBeNull()
    expect(result?.id).toBe(so.id)
    expect(result?.platformOrderId).toBe(order.id)
    expect(result?.shopId).toBe('shop-1')
    expect(result?.status).toBe('paid')
    expect(result?.shippingMethod).toBe('standard')
    expect(result?.shippingCostCents).toBe(500)
    expect(result?.subtotalCents).toBe(2000)
    expect(result?.buyer.id).toBe('user-1')
    expect(result?.buyer.name).toBe('Test')
    expect(result?.shippingAddress.name).toBe('Test Buyer')
    expect(result?.shippingAddress.city).toBe('Berlin')
    expect(result?.items).toHaveLength(1)
    expect(result?.items[0].productName).toBe('Vase')
    expect(result?.items[0].quantity).toBe(2)
  })

  it('returns order with tracking info', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'express',
        shippingCostCents: 1000,
        subtotalCents: 0,
        trackingNumber: 'TRACK123',
        trackingUrl: 'https://track.example.com/123',
      })
      .returning()

    const result = await getShopOrderQuery(so.id)
    expect(result?.trackingNumber).toBe('TRACK123')
    expect(result?.trackingUrl).toBe('https://track.example.com/123')
  })
})

describe('listShopOrdersQuery', () => {
  it('returns empty list when shop has no orders', async () => {
    await seedUser()
    await seedShop()

    const result = await listShopOrdersQuery('shop-1')
    expect(result.orders).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(result.totalPages).toBe(0)
  })

  it('returns paginated orders for a shop', async () => {
    await seedUser()
    await seedShop()
    const p = await seedProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 2500,
        status: 'paid',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 2000,
        status: 'paid',
      })
      .returning()

    await db.insert(orderItem).values({
      shopOrderId: so.id,
      productId: p.id,
      productName: p.name,
      unitPriceCents: p.priceCents,
      quantity: 2,
      totalCents: 2000,
    })

    const result = await listShopOrdersQuery('shop-1')
    expect(result.orders).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.totalPages).toBe(1)
    expect(result.orders[0].id).toBe(so.id)
    expect(result.orders[0].status).toBe('paid')
    expect(result.orders[0].buyerName).toBe('Test')
    expect(result.orders[0].buyerEmail).toBe('t***@example.com')
    expect(result.orders[0].itemCount).toBe(1)
    expect(result.orders[0].totalCents).toBe(2500)
  })

  it('filters by status', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()

    await db.insert(shopOrder).values({
      platformOrderId: order.id,
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 500,
      status: 'paid',
    })

    await db.insert(shopOrder).values({
      platformOrderId: order.id,
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 500,
      status: 'shipped',
    })

    const paidResult = await listShopOrdersQuery('shop-1', { status: 'paid' })
    expect(paidResult.orders).toHaveLength(1)
    expect(paidResult.orders[0].status).toBe('paid')

    const shippedResult = await listShopOrdersQuery('shop-1', { status: 'shipped' })
    expect(shippedResult.orders).toHaveLength(1)
    expect(shippedResult.orders[0].status).toBe('shipped')
  })

  it('applies pagination correctly', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()

    for (let i = 0; i < 5; i++) {
      await db.insert(shopOrder).values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 100,
        status: 'paid',
      })
    }

    const page1 = await listShopOrdersQuery('shop-1', { page: 1, pageSize: 2 })
    expect(page1.orders).toHaveLength(2)
    expect(page1.total).toBe(5)
    expect(page1.totalPages).toBe(3)

    const page2 = await listShopOrdersQuery('shop-1', { page: 2, pageSize: 2 })
    expect(page2.orders).toHaveLength(2)
    expect(page2.page).toBe(2)

    const page3 = await listShopOrdersQuery('shop-1', { page: 3, pageSize: 2 })
    expect(page3.orders).toHaveLength(1)
    expect(page3.page).toBe(3)
  })

  it('only returns orders for the specified shop', async () => {
    await seedUser()
    await seedShop()
    const shop2 = await db
      .insert(shop)
      .values({
        id: 'shop-2',
        name: 'Other Shop',
        slug: 'other-shop',
        ownerId: 'user-1',
      })
      .returning()
      .then((rows) => rows[0])

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()

    await db.insert(shopOrder).values({
      platformOrderId: order.id,
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 100,
      status: 'paid',
    })

    await db.insert(shopOrder).values({
      platformOrderId: order.id,
      shopId: shop2.id,
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 100,
      status: 'paid',
    })

    const result = await listShopOrdersQuery('shop-1')
    expect(result.orders).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('returns item count for each order', async () => {
    await seedUser()
    await seedShop()
    const p = await seedProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'paid',
      })
      .returning()

    await db.insert(orderItem).values([
      {
        shopOrderId: so.id,
        productId: p.id,
        productName: 'Vase',
        unitPriceCents: 500,
        quantity: 1,
        totalCents: 500,
      },
      {
        shopOrderId: so.id,
        productId: p.id,
        productName: 'Bowl',
        unitPriceCents: 400,
        quantity: 1,
        totalCents: 400,
      },
    ])

    const result = await listShopOrdersQuery('shop-1')
    expect(result.orders[0].itemCount).toBe(2)
  })
})

describe('isValidStatusTransition', () => {
  it('allows valid forward transitions', () => {
    expect(isValidStatusTransition('pending_payment', 'paid')).toBe(true)
    expect(isValidStatusTransition('paid', 'processing')).toBe(true)
    expect(isValidStatusTransition('processing', 'shipped')).toBe(true)
    expect(isValidStatusTransition('shipped', 'delivered')).toBe(true)
    expect(isValidStatusTransition('delivered', 'completed')).toBe(true)
  })

  it('allows cancellation from most statuses', () => {
    expect(isValidStatusTransition('pending_payment', 'cancelled')).toBe(true)
    expect(isValidStatusTransition('paid', 'cancelled')).toBe(true)
    expect(isValidStatusTransition('processing', 'cancelled')).toBe(true)
  })

  it('allows refund from most statuses', () => {
    expect(isValidStatusTransition('paid', 'refunded')).toBe(true)
    expect(isValidStatusTransition('processing', 'refunded')).toBe(true)
    expect(isValidStatusTransition('shipped', 'refunded')).toBe(true)
    expect(isValidStatusTransition('delivered', 'refunded')).toBe(true)
    expect(isValidStatusTransition('completed', 'refunded')).toBe(true)
  })

  it('allows disputed from shipped and delivered', () => {
    expect(isValidStatusTransition('shipped', 'disputed')).toBe(true)
    expect(isValidStatusTransition('delivered', 'disputed')).toBe(true)
    expect(isValidStatusTransition('processing', 'disputed')).toBe(false)
  })

  it('rejects invalid transitions', () => {
    expect(isValidStatusTransition('paid', 'pending_payment')).toBe(false)
    expect(isValidStatusTransition('shipped', 'processing')).toBe(false)
    expect(isValidStatusTransition('completed', 'shipped')).toBe(false)
    expect(isValidStatusTransition('cancelled', 'paid')).toBe(false)
    expect(isValidStatusTransition('refunded', 'cancelled')).toBe(false)
    expect(isValidStatusTransition('shipped', 'cancelled')).toBe(false)
    expect(isValidStatusTransition('delivered', 'cancelled')).toBe(false)
    expect(isValidStatusTransition('completed', 'cancelled')).toBe(false)
    expect(isValidStatusTransition('disputed', 'cancelled')).toBe(false)
  })
})

describe('derivePlatformStatus', () => {
  it('returns pending_payment when any child is pending_payment', () => {
    expect(derivePlatformStatus(['pending_payment', 'paid'])).toBe('pending_payment')
    expect(derivePlatformStatus(['pending_payment', 'completed'])).toBe('pending_payment')
  })

  it('returns paid when all children are paid or further and none are pending or processing', () => {
    expect(derivePlatformStatus(['paid', 'paid'])).toBe('paid')
    expect(derivePlatformStatus(['paid', 'shipped'])).toBe('paid')
  })

  it('returns processing when any child is processing and none are pending_payment', () => {
    expect(derivePlatformStatus(['processing', 'paid'])).toBe('processing')
    expect(derivePlatformStatus(['processing', 'shipped'])).toBe('processing')
  })

  it('returns shipped when all children are shipped or further', () => {
    expect(derivePlatformStatus(['shipped', 'shipped'])).toBe('shipped')
    expect(derivePlatformStatus(['shipped', 'delivered'])).toBe('shipped')
    expect(derivePlatformStatus(['shipped', 'completed'])).toBe('shipped')
  })

  it('returns delivered when all children are delivered or further', () => {
    expect(derivePlatformStatus(['delivered', 'delivered'])).toBe('delivered')
    expect(derivePlatformStatus(['delivered', 'completed'])).toBe('delivered')
  })

  it('returns completed when all children are completed', () => {
    expect(derivePlatformStatus(['completed', 'completed'])).toBe('completed')
  })

  it('returns refunded when all children are refunded', () => {
    expect(derivePlatformStatus(['refunded', 'refunded'])).toBe('refunded')
  })

  it('returns disputed when any child is disputed', () => {
    expect(derivePlatformStatus(['disputed', 'paid'])).toBe('disputed')
    expect(derivePlatformStatus(['disputed', 'completed'])).toBe('disputed')
  })

  it('returns cancelled when all children are cancelled', () => {
    expect(derivePlatformStatus(['cancelled', 'cancelled'])).toBe('cancelled')
  })

  it('returns pending_payment for empty array', () => {
    expect(derivePlatformStatus([])).toBe('pending_payment')
  })

  it('correctly handles mixtures of terminal/cancelled/refunded and active states', () => {
    expect(derivePlatformStatus(['completed', 'cancelled'])).toBe('completed')
    expect(derivePlatformStatus(['completed', 'refunded'])).toBe('completed')
    expect(derivePlatformStatus(['paid', 'cancelled'])).toBe('paid')
    expect(derivePlatformStatus(['shipped', 'cancelled'])).toBe('shipped')
    expect(derivePlatformStatus(['processing', 'refunded'])).toBe('processing')
    expect(derivePlatformStatus(['cancelled', 'refunded'])).toBe('refunded')
  })
})

describe('updateShopOrderStatusQuery', () => {
  it('throws 404 for nonexistent order', async () => {
    try {
      await updateShopOrderStatusQuery('550e8400-e29b-41d4-a716-446655440000', {
        status: 'paid',
      })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('throws 400 for invalid transition', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'pending_payment',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'pending_payment',
      })
      .returning()

    try {
      await updateShopOrderStatusQuery(so.id, { status: 'shipped' })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
    }
  })

  it('updates status and recalculates platform status', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'paid',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'paid',
      })
      .returning()

    const updated = await updateShopOrderStatusQuery(so.id, { status: 'processing' })
    expect(updated.status).toBe('processing')

    const [platformRecord] = await db
      .select()
      .from(platformOrder)
      .where(eq(platformOrder.id, order.id))
    expect(platformRecord.status).toBe('processing')
  })

  it('sets tracking info when transitioning to shipped', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'processing',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'processing',
      })
      .returning()

    const updated = await updateShopOrderStatusQuery(so.id, {
      status: 'shipped',
      trackingNumber: 'TRACK-123',
      trackingUrl: 'https://track.example.com/123',
    })

    expect(updated.status).toBe('shipped')
    expect(updated.trackingNumber).toBe('TRACK-123')
    expect(updated.trackingUrl).toBe('https://track.example.com/123')
  })

  it('does not set tracking info for non-shipped transitions', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'paid',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'paid',
      })
      .returning()

    const updated = await updateShopOrderStatusQuery(so.id, {
      status: 'processing',
      trackingNumber: 'TRACK-123',
    })

    expect(updated.status).toBe('processing')
    expect(updated.trackingNumber).toBeNull()
  })
})

describe('markShopOrderShippedQuery', () => {
  it('throws 404 for nonexistent order', async () => {
    try {
      await markShopOrderShippedQuery('550e8400-e29b-41d4-a716-446655440000', {})
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('throws 400 for invalid tracking URL', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'processing',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'processing',
      })
      .returning()

    try {
      await markShopOrderShippedQuery(so.id, { trackingUrl: 'not-a-url' })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
    }
  })

  it('throws 400 for invalid status transition', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'pending_payment',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'pending_payment',
      })
      .returning()

    try {
      await markShopOrderShippedQuery(so.id, {})
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
    }
  })

  it('transitions from paid to shipped', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'paid',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'paid',
      })
      .returning()

    const updated = await markShopOrderShippedQuery(so.id, {
      trackingNumber: 'TRACK-123',
      trackingUrl: 'https://track.example.com/123',
    })

    expect(updated.status).toBe('shipped')
    expect(updated.trackingNumber).toBe('TRACK-123')
    expect(updated.trackingUrl).toBe('https://track.example.com/123')

    const [platformRecord] = await db
      .select()
      .from(platformOrder)
      .where(eq(platformOrder.id, order.id))
    expect(platformRecord.status).toBe('shipped')
  })

  it('transitions from processing to shipped', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'processing',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'processing',
      })
      .returning()

    const updated = await markShopOrderShippedQuery(so.id, {})
    expect(updated.status).toBe('shipped')
  })

  it('is idempotent when order is already shipped', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'shipped',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'shipped',
        trackingNumber: 'OLD-TRACK',
        trackingUrl: 'https://old.example.com',
      })
      .returning()

    const updated = await markShopOrderShippedQuery(so.id, {})
    expect(updated.status).toBe('shipped')
    expect(updated.trackingNumber).toBe('OLD-TRACK')
    expect(updated.trackingUrl).toBe('https://old.example.com')
  })

  it('updates tracking info on already-shipped order', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'shipped',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'shipped',
        trackingNumber: 'OLD-TRACK',
        trackingUrl: 'https://old.example.com',
      })
      .returning()

    const updated = await markShopOrderShippedQuery(so.id, {
      trackingNumber: 'NEW-TRACK',
      trackingUrl: 'https://new.example.com',
    })
    expect(updated.status).toBe('shipped')
    expect(updated.trackingNumber).toBe('NEW-TRACK')
    expect(updated.trackingUrl).toBe('https://new.example.com')
  })

  it('prevents duplicate logs and notifications under concurrent executions', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: { name: 'Test', street: 'St', city: 'City', postalCode: '00000', country: 'DE' },
        billingAddress: { name: 'Test', street: 'St', city: 'City', postalCode: '00000', country: 'DE' },
        totalCents: 1000,
        status: 'paid',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'paid',
      })
      .returning()

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    // Simulate concurrent calls
    const [res1, res2] = await Promise.all([
      markShopOrderShippedQuery(so.id, { trackingNumber: 'TRACK-1' }),
      markShopOrderShippedQuery(so.id, { trackingNumber: 'TRACK-2' }),
    ])

    expect(res1.status).toBe('shipped')
    expect(res2.status).toBe('shipped')

    // Find all 'order_shipped' events in console.log
    const loggedEvents = consoleSpy.mock.calls
      .map((args: any[]) => {
        try {
          return JSON.parse(args[0])
        } catch {
          return null
        }
      })
      .filter((entry: any) => entry && entry.event === 'order_shipped')

    // Expect only 1 transition/log
    expect(loggedEvents).toHaveLength(1)
    consoleSpy.mockRestore()
  })
})

describe('markShopOrderDeliveredQuery', () => {
  it('throws 404 for nonexistent order', async () => {
    try {
      await markShopOrderDeliveredQuery('550e8400-e29b-41d4-a716-446655440000')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('throws 400 for invalid status transition', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'paid',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'paid',
      })
      .returning()

    try {
      await markShopOrderDeliveredQuery(so.id)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
    }
  })

  it('transitions from shipped to delivered', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'shipped',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'shipped',
      })
      .returning()

    const updated = await markShopOrderDeliveredQuery(so.id)
    expect(updated.status).toBe('delivered')

    const [platformRecord] = await db
      .select()
      .from(platformOrder)
      .where(eq(platformOrder.id, order.id))
    expect(platformRecord.status).toBe('delivered')
  })

  it('is idempotent when order is already delivered', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'delivered',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'delivered',
      })
      .returning()

    const updated = await markShopOrderDeliveredQuery(so.id)
    expect(updated.status).toBe('delivered')
  })

  it('prevents duplicate logs under concurrent executions', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: { name: 'Test', street: 'St', city: 'City', postalCode: '00000', country: 'DE' },
        billingAddress: { name: 'Test', street: 'St', city: 'City', postalCode: '00000', country: 'DE' },
        totalCents: 1000,
        status: 'shipped',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'shipped',
      })
      .returning()

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    // Simulate concurrent calls
    const [res1, res2] = await Promise.all([
      markShopOrderDeliveredQuery(so.id),
      markShopOrderDeliveredQuery(so.id),
    ])

    expect(res1.status).toBe('delivered')
    expect(res2.status).toBe('delivered')

    // Find all 'order_delivered' events in console.log
    const loggedEvents = consoleSpy.mock.calls
      .map((args: any[]) => {
        try {
          return JSON.parse(args[0])
        } catch {
          return null
        }
      })
      .filter((entry: any) => entry && entry.event === 'order_delivered')

    // Expect only 1 log
    expect(loggedEvents).toHaveLength(1)
    consoleSpy.mockRestore()
  })
})

describe('recalcPlatformOrderStatus', () => {
  it('updates platform order to shipped when all shop orders are shipped', async () => {
    await seedUser()
    await seedShop()
    const shop2 = await db
      .insert(shop)
      .values({
        id: 'shop-2',
        name: 'Other Shop',
        slug: 'other-shop',
        ownerId: 'user-1',
      })
      .returning()
      .then((rows) => rows[0])

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 2000,
        status: 'processing',
      })
      .returning()

    await db.insert(shopOrder).values({
      platformOrderId: order.id,
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'shipped',
    })

    await db.insert(shopOrder).values({
      platformOrderId: order.id,
      shopId: shop2.id,
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'shipped',
    })

    await recalcPlatformOrderStatus(db, order.id)

    const [updated] = await db.select().from(platformOrder).where(eq(platformOrder.id, order.id))
    expect(updated.status).toBe('shipped')
  })

  it('updates platform order to delivered when all shop orders are delivered', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'shipped',
      })
      .returning()

    await db.insert(shopOrder).values({
      platformOrderId: order.id,
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'delivered',
    })

    await recalcPlatformOrderStatus(db, order.id)

    const [updated] = await db.select().from(platformOrder).where(eq(platformOrder.id, order.id))
    expect(updated.status).toBe('delivered')
  })
})

describe('createShippingLabelForOrderQuery', () => {
  it('throws 404 for nonexistent order', async () => {
    try {
      await createShippingLabelForOrderQuery('550e8400-e29b-41d4-a716-446655440000')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('throws 400 when shop shipping origin is not configured', async () => {
    await seedUser()
    await seedShop()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test Buyer',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test Buyer',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'paid',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'paid',
      })
      .returning()

    try {
      await createShippingLabelForOrderQuery(so.id)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
      const body = await (err as Response).json()
      expect(body.message).toContain('origin address is not configured')
    }
  })

  it('creates a shipping label and stores it in the database', async () => {
    await seedUser()
    await seedShop({
      shippingOrigin: {
        street: '456 Warehouse Ave',
        city: 'Paris',
        postalCode: '75001',
        country: 'FR',
      },
    })

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test Buyer',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test Buyer',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'paid',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'paid',
      })
      .returning()

    const label = await createShippingLabelForOrderQuery(so.id)
    expect(label.carrier).toBe('mondial_relay')
    expect(label.trackingNumber).toBeTruthy()
    expect(label.labelUrl).toBeTruthy()

    const orderWithLabel = await getShopOrderQuery(so.id)
    expect(orderWithLabel?.label).not.toBeNull()
    expect(orderWithLabel?.label?.carrier).toBe('mondial_relay')
  })
})

describe('markShopOrderShippedWithLabelQuery', () => {
  it('creates label, marks order shipped, and stores tracking info', async () => {
    await seedUser()
    await seedShop({
      shippingOrigin: {
        street: '456 Warehouse Ave',
        city: 'Paris',
        postalCode: '75001',
        country: 'FR',
      },
    })

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test Buyer',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test Buyer',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'paid',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'paid',
      })
      .returning()

    const updated = await markShopOrderShippedWithLabelQuery(so.id)
    expect(updated.status).toBe('shipped')
    expect(updated.trackingNumber).toBeTruthy()
    expect(updated.trackingUrl).toBeTruthy()
    expect(updated.label).not.toBeNull()

    const [platformRecord] = await db
      .select()
      .from(platformOrder)
      .where(eq(platformOrder.id, order.id))
    expect(platformRecord.status).toBe('shipped')
  })

  it('does not mark shipped when label generation fails', async () => {
    await seedUser()
    await seedShop() // no shipping origin

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test Buyer',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test Buyer',
          street: '123 Main St',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
        totalCents: 1000,
        status: 'paid',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 100,
        subtotalCents: 900,
        status: 'paid',
      })
      .returning()

    try {
      await markShopOrderShippedWithLabelQuery(so.id)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
    }

    const unchanged = await getShopOrderQuery(so.id)
    expect(unchanged?.status).toBe('paid')
  })
})
