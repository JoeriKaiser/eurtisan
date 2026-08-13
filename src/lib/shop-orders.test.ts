import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { inventoryReservation, platformOrder, product } from '#/db/schema'

import { clearTestTables } from '#/test/cleanup'
import {
  createInventoryReservation,
  createOrderItem,
  createPlatformOrder,
  createProduct,
  createShop,
  createShopOrder,
  createUser,
} from '#/test/factories'
import { makeTestAddress } from '#/test/helpers'

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
  await clearTestTables()
})

afterAll(async () => {
  await clearTestTables()
})

async function seedUser(overrides?: Parameters<typeof createUser>[0]) {
  return createUser({
    id: 'user-1',
    name: 'Test',
    email: 'test@example.com',
    emailVerified: true,
    ...overrides,
  })
}

async function seedShop(overrides?: Parameters<typeof createShop>[1]) {
  return createShop('user-1', {
    id: 'shop-1',
    name: 'Test Shop',
    slug: 'test-shop',
    ...overrides,
  })
}

async function seedProduct(overrides?: Parameters<typeof createProduct>[1]) {
  return createProduct('shop-1', {
    id: 'prod-1',
    name: 'Vase',
    slug: 'vase',
    priceCents: 1000,
    stockCount: 10,
    ...overrides,
  })
}

describe('getShopOrderDetailQuery', () => {
  it('returns null for nonexistent order', async () => {
    const result = await getShopOrderDetailQuery('550e8400-e29b-41d4-a716-446655440000')
    expect(result).toBeNull()
  })

  it('masks buyer email in the response', async () => {
    await seedUser()
    await seedShop()

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress(),
      billingAddress: makeTestAddress(),
      totalCents: 1000,
      status: 'paid',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'paid',
    })

    const result = await getShopOrderDetailQuery(so.id)
    expect(result).not.toBeNull()
    expect(result?.buyer.email).toBe('t***@example.com')
    expect(result?.buyer.name).toBe('Test')
  })

  it('returns full order detail with items and shipping address', async () => {
    await seedUser()
    await seedShop()
    const p = await seedProduct()

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress(),
      billingAddress: makeTestAddress(),
      totalCents: 2500,
      status: 'paid',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 2000,
      status: 'paid',
    })

    await createOrderItem(so, p, {
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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress(),
      billingAddress: makeTestAddress(),
      totalCents: 2500,
      status: 'paid',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 2000,
      status: 'paid',
    })

    await createOrderItem(so, p, {
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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'express',
      shippingCostCents: 1000,
      subtotalCents: 0,
      trackingNumber: 'TRACK123',
      trackingUrl: 'https://track.example.com/123',
    })

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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 2500,
      status: 'paid',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 2000,
      status: 'paid',
    })

    await createOrderItem(so, p, {
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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
    })

    await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 500,
      status: 'paid',
    })

    await createShopOrder(order, 'shop-1', {
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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
    })

    for (let i = 0; i < 5; i++) {
      await createShopOrder(order, 'shop-1', {
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
    const shop2 = await createShop('user-1', {
      id: 'shop-2',
      name: 'Other Shop',
      slug: 'other-shop',
    })

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
    })

    await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 100,
      status: 'paid',
    })

    await createShopOrder(order, shop2, {
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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'paid',
    })

    await createOrderItem(so, p, {
      productName: 'Vase',
      unitPriceCents: 500,
      quantity: 1,
      totalCents: 500,
    })

    await createOrderItem(so, p, {
      productName: 'Bowl',
      unitPriceCents: 400,
      quantity: 1,
      totalCents: 400,
    })

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

  it('allows cancellation only from pending_payment', () => {
    expect(isValidStatusTransition('pending_payment', 'cancelled')).toBe(true)
    expect(isValidStatusTransition('paid', 'cancelled')).toBe(false)
    expect(isValidStatusTransition('processing', 'cancelled')).toBe(false)
  })

  it('allows refund from most statuses', () => {
    expect(isValidStatusTransition('paid', 'refunded')).toBe(true)
    expect(isValidStatusTransition('processing', 'refunded')).toBe(true)
    expect(isValidStatusTransition('shipped', 'refunded')).toBe(true)
    expect(isValidStatusTransition('delivered', 'refunded')).toBe(true)
    expect(isValidStatusTransition('completed', 'refunded')).toBe(true)
  })

  it('allows disputes for paid and fulfilled orders', () => {
    expect(isValidStatusTransition('paid', 'disputed')).toBe(true)
    expect(isValidStatusTransition('processing', 'disputed')).toBe(true)
    expect(isValidStatusTransition('shipped', 'disputed')).toBe(true)
    expect(isValidStatusTransition('delivered', 'disputed')).toBe(true)
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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'pending_payment',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'pending_payment',
    })

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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'paid',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'paid',
    })

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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'processing',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'processing',
    })

    const updated = await updateShopOrderStatusQuery(so.id, {
      status: 'shipped',
      trackingNumber: 'TRACK-123',
      trackingUrl: 'https://track.example.com/123',
    })

    expect(updated.status).toBe('shipped')
    expect(updated.trackingNumber).toBe('TRACK-123')
    expect(updated.trackingUrl).toBe('https://track.example.com/123')
  })

  it('throws 400 for javascript: tracking URL via updateShopOrderStatusQuery', async () => {
    await seedUser()
    await seedShop()

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'processing',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'processing',
    })

    try {
      await updateShopOrderStatusQuery(so.id, {
        status: 'shipped',
        trackingUrl: 'javascript:alert(1)',
      })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
    }
  })

  it('does not set tracking info for non-shipped transitions', async () => {
    await seedUser()
    await seedShop()

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'paid',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'paid',
    })

    const updated = await updateShopOrderStatusQuery(so.id, {
      status: 'processing',
      trackingNumber: 'TRACK-123',
    })

    expect(updated.status).toBe('processing')
    expect(updated.trackingNumber).toBeNull()
  })

  it('throws 400 when cancelling a paid order (refund-first enforcement)', async () => {
    await seedUser()
    await seedShop()

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'paid',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'paid',
    })

    try {
      await updateShopOrderStatusQuery(so.id, { status: 'cancelled' })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
      const body = await (err as Response).json()
      expect(body.message).toBe("Invalid status transition from 'paid' to 'cancelled'")
    }
  })

  it('throws 400 when cancelling a processing order (refund-first enforcement)', async () => {
    await seedUser()
    await seedShop()

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'processing',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'processing',
    })

    try {
      await updateShopOrderStatusQuery(so.id, { status: 'cancelled' })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
      const body = await (err as Response).json()
      expect(body.message).toBe("Invalid status transition from 'processing' to 'cancelled'")
    }
  })

  it('decrements stock and deletes reservations when transitioning to paid', async () => {
    await seedUser()
    await seedShop()
    const p = await seedProduct({ stockCount: 10 })

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress(),
      billingAddress: makeTestAddress(),
      totalCents: 1000,
      status: 'pending_payment',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'pending_payment',
    })

    await createOrderItem(so, p, {
      quantity: 3,
      totalCents: p.priceCents * 3,
    })

    await createInventoryReservation(p, {
      platformOrderId: order.id,
      quantity: 3,
      expiresAt: new Date(Date.now() + 60_000),
    })

    const updated = await updateShopOrderStatusQuery(so.id, { status: 'paid' })
    expect(updated.status).toBe('paid')

    const [platformRecord] = await db
      .select()
      .from(platformOrder)
      .where(eq(platformOrder.id, order.id))
    expect(platformRecord.status).toBe('paid')

    const [updatedProduct] = await db.select().from(product).where(eq(product.id, p.id))
    expect(updatedProduct.stockCount).toBe(7)

    const reservations = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.platformOrderId, order.id))
    expect(reservations).toHaveLength(0)
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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'processing',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'processing',
    })

    try {
      await markShopOrderShippedQuery(so.id, { trackingUrl: 'not-a-url' })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
    }
  })

  it('throws 400 for javascript: tracking URL', async () => {
    await seedUser()
    await seedShop()

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'processing',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'processing',
    })

    try {
      await markShopOrderShippedQuery(so.id, { trackingUrl: 'javascript:alert(1)' })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
    }
  })

  it('throws 400 for data: tracking URL', async () => {
    await seedUser()
    await seedShop()

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'processing',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'processing',
    })

    try {
      await markShopOrderShippedQuery(so.id, {
        trackingUrl: 'data:text/html,<script>alert(1)</script>',
      })
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(400)
    }
  })

  it('throws 400 for invalid status transition', async () => {
    await seedUser()
    await seedShop()

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'pending_payment',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'pending_payment',
    })

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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'paid',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'paid',
    })

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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'processing',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'processing',
    })

    const updated = await markShopOrderShippedQuery(so.id, {})
    expect(updated.status).toBe('shipped')
  })

  it('is idempotent when order is already shipped', async () => {
    await seedUser()
    await seedShop()

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'shipped',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'shipped',
      trackingNumber: 'OLD-TRACK',
      trackingUrl: 'https://old.example.com',
    })

    const updated = await markShopOrderShippedQuery(so.id, {})
    expect(updated.status).toBe('shipped')
    expect(updated.trackingNumber).toBe('OLD-TRACK')
    expect(updated.trackingUrl).toBe('https://old.example.com')
  })

  it('updates tracking info on already-shipped order', async () => {
    await seedUser()
    await seedShop()

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'shipped',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'shipped',
      trackingNumber: 'OLD-TRACK',
      trackingUrl: 'https://old.example.com',
    })

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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'paid',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'paid',
    })

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
      .map((args: unknown[]) => {
        try {
          return JSON.parse(String(args[0]))
        } catch {
          return null
        }
      })
      .filter((entry: unknown) => entry && (entry as { event?: string }).event === 'order_shipped')

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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'paid',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'paid',
    })

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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'shipped',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'shipped',
    })

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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'delivered',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'delivered',
    })

    const updated = await markShopOrderDeliveredQuery(so.id)
    expect(updated.status).toBe('delivered')
  })

  it('prevents duplicate logs under concurrent executions', async () => {
    await seedUser()
    await seedShop()

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'shipped',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'shipped',
    })

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
      .map((args: unknown[]) => {
        try {
          return JSON.parse(String(args[0]))
        } catch {
          return null
        }
      })
      .filter(
        (entry: unknown) => entry && (entry as { event?: string }).event === 'order_delivered',
      )

    // Expect only 1 log
    expect(loggedEvents).toHaveLength(1)
    consoleSpy.mockRestore()
  })
})

describe('recalcPlatformOrderStatus', () => {
  it('updates platform order to shipped when all shop orders are shipped', async () => {
    await seedUser()
    await seedShop()
    const shop2 = await createShop('user-1', {
      id: 'shop-2',
      name: 'Other Shop',
      slug: 'other-shop',
    })

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 2000,
      status: 'processing',
    })

    await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'shipped',
    })

    await createShopOrder(order, shop2, {
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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      billingAddress: makeTestAddress({
        name: 'Test',
        street: 'St',
        city: 'City',
        postalCode: '00000',
        country: 'DE',
      }),
      totalCents: 1000,
      status: 'shipped',
    })

    await createShopOrder(order, 'shop-1', {
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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress(),
      billingAddress: makeTestAddress(),
      totalCents: 1000,
      status: 'paid',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'paid',
    })

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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress(),
      billingAddress: makeTestAddress(),
      totalCents: 1000,
      status: 'paid',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'paid',
    })

    const label = await createShippingLabelForOrderQuery(so.id)
    expect(label.carrier).toBe('sendcloud')
    expect(label.trackingNumber).toBeTruthy()
    expect(label.labelUrl).toBeTruthy()

    const orderWithLabel = await getShopOrderQuery(so.id)
    expect(orderWithLabel?.labels).toHaveLength(1)
    expect(orderWithLabel?.labels[0].carrier).toBe('sendcloud')
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

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress(),
      billingAddress: makeTestAddress(),
      totalCents: 1000,
      status: 'paid',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'paid',
    })

    const updated = await markShopOrderShippedWithLabelQuery(so.id)
    expect(updated.status).toBe('shipped')
    expect(updated.trackingNumber).toBeTruthy()
    expect(updated.trackingUrl).toBeTruthy()
    expect(updated.labels).toHaveLength(1)
    expect(updated.labels[0].trackingNumber).toBeTruthy()

    const [platformRecord] = await db
      .select()
      .from(platformOrder)
      .where(eq(platformOrder.id, order.id))
    expect(platformRecord.status).toBe('shipped')
  })

  it('does not mark shipped when label generation fails', async () => {
    await seedUser()
    await seedShop() // no shipping origin

    const order = await createPlatformOrder('user-1', {
      shippingAddress: makeTestAddress(),
      billingAddress: makeTestAddress(),
      totalCents: 1000,
      status: 'paid',
    })

    const so = await createShopOrder(order, 'shop-1', {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 900,
      status: 'paid',
    })

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
