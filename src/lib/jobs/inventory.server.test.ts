import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import {
  inventoryReservation,
  orderItem,
  platformOrder,
  product,
  shop,
  shopOrder,
  user,
} from '#/db/schema'

import {
  cancelAbandonedPendingPaymentOrders,
  decrementStockForPaidOrder,
  releaseExpiredReservations,
  restoreShopOrderStockInTx,
} from './inventory.server'

describe('releaseExpiredReservations (inArray batch delete)', () => {
  beforeEach(async () => {
    await db.delete(inventoryReservation)
    await db.delete(shopOrder)
    await db.delete(platformOrder)
    await db.delete(product)
    await db.delete(shop)
    await db.delete(user)
  })

  async function seedUserShopProduct() {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
      })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({
        id: 'shop-1',
        name: 'Test Shop',
        slug: 'test-shop',
        ownerId: u.id,
      })
      .returning()

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
        stockCount: 10,
      })
      .returning()

    return { user: u, shop: s, product: p }
  }

  it('deletes multiple expired reservations in a single batch via inArray', async () => {
    const { product: p } = await seedUserShopProduct()

    const orders = []
    for (let i = 0; i < 3; i++) {
      const [order] = await db
        .insert(platformOrder)
        .values({
          userId: 'user-1',
          shippingAddress: { street: `${i} Oak` },
          billingAddress: { street: `${i} Oak` },
          totalCents: 100,
          status: 'pending_payment',
        })
        .returning()
      orders.push(order)
    }

    for (const order of orders) {
      await db.insert(inventoryReservation).values({
        productId: p.id,
        platformOrderId: order.id,
        quantity: 1,
        expiresAt: new Date(Date.now() - 60_000),
      })
    }

    const result = await releaseExpiredReservations(100)
    expect(result.releasedCount).toBe(3)

    const remaining = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.productId, p.id))

    expect(remaining).toHaveLength(0)
  })

  it('deletes a single expired reservation when only one row matches', async () => {
    const { product: p } = await seedUserShopProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: { street: '123 Main' },
        billingAddress: { street: '123 Main' },
        totalCents: 100,
        status: 'pending_payment',
      })
      .returning()

    await db.insert(inventoryReservation).values({
      productId: p.id,
      platformOrderId: order.id,
      quantity: 2,
      expiresAt: new Date(Date.now() - 60_000),
    })

    const result = await releaseExpiredReservations()
    expect(result.releasedCount).toBe(1)

    const remaining = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.platformOrderId, order.id))

    expect(remaining).toHaveLength(0)
  })

  it('returns zero when no expired reservations exist', async () => {
    const { product: p } = await seedUserShopProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: { street: '123 Main' },
        billingAddress: { street: '123 Main' },
        totalCents: 100,
        status: 'pending_payment',
      })
      .returning()

    await db.insert(inventoryReservation).values({
      productId: p.id,
      platformOrderId: order.id,
      quantity: 2,
      expiresAt: new Date(Date.now() + 60_000),
    })

    const result = await releaseExpiredReservations()
    expect(result.releasedCount).toBe(0)

    const remaining = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.platformOrderId, order.id))

    expect(remaining).toHaveLength(1)
  })
})

describe('cancelAbandonedPendingPaymentOrders', () => {
  beforeEach(async () => {
    await db.delete(inventoryReservation)
    await db.delete(shopOrder)
    await db.delete(platformOrder)
    await db.delete(product)
    await db.delete(shop)
    await db.delete(user)
  })

  async function seedUserShopProduct() {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
      })
      .returning()

    const [s] = await db
      .insert(shop)
      .values({
        id: 'shop-1',
        name: 'Test Shop',
        slug: 'test-shop',
        ownerId: u.id,
      })
      .returning()

    const [p] = await db
      .insert(product)
      .values({
        id: 'prod-1',
        name: 'Vase',
        slug: 'vase',
        priceCents: 2999,
        shopId: s.id,
        stockCount: 10,
      })
      .returning()

    return { user: u, shop: s, product: p }
  }

  it('cancels multiple abandoned pending_payment orders and releases stock', async () => {
    const { product: p } = await seedUserShopProduct()

    const orders = []
    for (let i = 0; i < 3; i++) {
      const [order] = await db
        .insert(platformOrder)
        .values({
          userId: 'user-1',
          shippingAddress: { street: `${i} Oak` },
          billingAddress: { street: `${i} Oak` },
          totalCents: 100,
          status: 'pending_payment',
          createdAt: new Date(Date.now() - 31 * 60_000),
        })
        .returning()
      orders.push(order)

      await db.insert(shopOrder).values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        status: 'pending_payment',
      })

      await db.insert(inventoryReservation).values({
        productId: p.id,
        platformOrderId: order.id,
        quantity: 1,
        expiresAt: new Date(Date.now() + 60_000),
      })
    }

    const result = await cancelAbandonedPendingPaymentOrders(100)
    expect(result.cancelledCount).toBe(3)

    for (const order of orders) {
      const [updatedPlatformOrder] = await db
        .select()
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))

      expect(updatedPlatformOrder.status).toBe('cancelled')
      expect(updatedPlatformOrder.cancelledAt).not.toBeNull()
      expect(updatedPlatformOrder.cancellationReason).toBe(
        'Abandoned: payment not received within 30 minutes',
      )

      const [updatedShopOrder] = await db
        .select()
        .from(shopOrder)
        .where(eq(shopOrder.platformOrderId, order.id))

      expect(updatedShopOrder.status).toBe('cancelled')

      const reservations = await db
        .select()
        .from(inventoryReservation)
        .where(eq(inventoryReservation.platformOrderId, order.id))

      expect(reservations).toHaveLength(0)
    }
  })

  it('does not cancel recent pending_payment orders', async () => {
    const { product: p } = await seedUserShopProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: { street: '123 Main' },
        billingAddress: { street: '123 Main' },
        totalCents: 100,
        status: 'pending_payment',
        createdAt: new Date(Date.now() - 5 * 60_000),
      })
      .returning()

    await db.insert(shopOrder).values({
      platformOrderId: order.id,
      shopId: 'shop-1',
      status: 'pending_payment',
    })

    await db.insert(inventoryReservation).values({
      productId: p.id,
      platformOrderId: order.id,
      quantity: 2,
      expiresAt: new Date(Date.now() + 60_000),
    })

    const result = await cancelAbandonedPendingPaymentOrders()
    expect(result.cancelledCount).toBe(0)

    const [platformOrderRow] = await db
      .select()
      .from(platformOrder)
      .where(eq(platformOrder.id, order.id))

    expect(platformOrderRow.status).toBe('pending_payment')
    expect(platformOrderRow.cancelledAt).toBeNull()

    const [shopOrderRow] = await db
      .select()
      .from(shopOrder)
      .where(eq(shopOrder.platformOrderId, order.id))

    expect(shopOrderRow.status).toBe('pending_payment')

    const reservations = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.platformOrderId, order.id))

    expect(reservations).toHaveLength(1)
  })

  it('does not cancel orders with other statuses', async () => {
    const { product: p } = await seedUserShopProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: { street: '123 Main' },
        billingAddress: { street: '123 Main' },
        totalCents: 100,
        status: 'paid',
        createdAt: new Date(Date.now() - 31 * 60_000),
      })
      .returning()

    await db.insert(shopOrder).values({
      platformOrderId: order.id,
      shopId: 'shop-1',
      status: 'paid',
    })

    await db.insert(inventoryReservation).values({
      productId: p.id,
      platformOrderId: order.id,
      quantity: 2,
      expiresAt: new Date(Date.now() + 60_000),
    })

    const result = await cancelAbandonedPendingPaymentOrders()
    expect(result.cancelledCount).toBe(0)

    const [platformOrderRow] = await db
      .select()
      .from(platformOrder)
      .where(eq(platformOrder.id, order.id))

    expect(platformOrderRow.status).toBe('paid')

    const reservations = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.platformOrderId, order.id))

    expect(reservations).toHaveLength(1)
  })

  it('returns zero when no abandoned orders exist', async () => {
    await seedUserShopProduct()

    const result = await cancelAbandonedPendingPaymentOrders()
    expect(result.cancelledCount).toBe(0)
  })

  it('respects the batch size limit', async () => {
    await seedUserShopProduct()

    const orders = []
    for (let i = 0; i < 5; i++) {
      const [order] = await db
        .insert(platformOrder)
        .values({
          userId: 'user-1',
          shippingAddress: { street: `${i} Oak` },
          billingAddress: { street: `${i} Oak` },
          totalCents: 100,
          status: 'pending_payment',
          createdAt: new Date(Date.now() - 31 * 60_000),
        })
        .returning()
      orders.push(order)

      await db.insert(shopOrder).values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        status: 'pending_payment',
      })
    }

    const result = await cancelAbandonedPendingPaymentOrders(2)
    expect(result.cancelledCount).toBe(2)

    const cancelled = await db
      .select()
      .from(platformOrder)
      .where(eq(platformOrder.status, 'cancelled'))

    expect(cancelled).toHaveLength(2)
  })
})

describe('restoreShopOrderStockInTx', () => {
  beforeEach(async () => {
    await db.delete(orderItem)
    await db.delete(inventoryReservation)
    await db.delete(shopOrder)
    await db.delete(platformOrder)
    await db.delete(product)
    await db.delete(shop)
    await db.delete(user)
  })

  async function seedRestoreFixture() {
    const [owner] = await db
      .insert(user)
      .values({
        id: randomUUID(),
        name: 'Owner',
        email: 'owner@example.com',
        role: 'creator',
        emailVerified: true,
      })
      .returning()

    const [shopRecord] = await db
      .insert(shop)
      .values({
        id: randomUUID(),
        name: 'Test Shop',
        slug: 'test-shop',
        ownerId: owner.id,
      })
      .returning()

    const [buyer] = await db
      .insert(user)
      .values({
        id: randomUUID(),
        name: 'Buyer',
        email: 'buyer@example.com',
        role: 'customer',
      })
      .returning()

    const [prod] = await db
      .insert(product)
      .values({
        id: randomUUID(),
        name: 'Vase',
        slug: 'vase',
        priceCents: 1000,
        shopId: shopRecord.id,
        stockCount: 5,
      })
      .returning()

    const [po] = await db
      .insert(platformOrder)
      .values({
        id: randomUUID(),
        userId: buyer.id,
        shippingAddress: { name: 'Buyer', country: 'FR' },
        billingAddress: { name: 'Buyer', country: 'FR' },
        totalCents: 2000,
        status: 'paid',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({
        id: randomUUID(),
        platformOrderId: po.id,
        shopId: shopRecord.id,
        status: 'paid',
      })
      .returning()

    await db.insert(orderItem).values({
      id: randomUUID(),
      shopOrderId: so.id,
      productId: prod.id,
      productName: 'Vase',
      unitPriceCents: 1000,
      quantity: 2,
      totalCents: 2000,
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
    })

    await db.insert(inventoryReservation).values({
      productId: prod.id,
      platformOrderId: po.id,
      quantity: 2,
      expiresAt: new Date(Date.now() + 60_000),
    })

    return { product: prod, platformOrder: po, shopOrder: so }
  }

  it('restores product stock and removes the reservation', async () => {
    const { product: prod, platformOrder: po, shopOrder: so } = await seedRestoreFixture()

    await db.transaction(async (tx) => {
      await restoreShopOrderStockInTx(tx, po.id, so.id)
    })

    const [updated] = await db.select().from(product).where(eq(product.id, prod.id))
    expect(updated.stockCount).toBe(7)

    const reservations = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.platformOrderId, po.id))
    expect(reservations).toHaveLength(0)
  })

  it('restores stock even when the reservation was already released', async () => {
    const { product: prod, platformOrder: po, shopOrder: so } = await seedRestoreFixture()
    await db.delete(inventoryReservation).where(eq(inventoryReservation.platformOrderId, po.id))

    await db.transaction(async (tx) => {
      await restoreShopOrderStockInTx(tx, po.id, so.id)
    })

    const [updated] = await db.select().from(product).where(eq(product.id, prod.id))
    expect(updated.stockCount).toBe(7)
  })
})

describe('decrementStockForPaidOrder oversell handling', () => {
  beforeEach(async () => {
    await db.delete(orderItem)
    await db.delete(inventoryReservation)
    await db.delete(shopOrder)
    await db.delete(platformOrder)
    await db.delete(product)
    await db.delete(shop)
    await db.delete(user)
  })

  /** Seeds an order for `orderQuantity` units against `stockCount` in stock. */
  async function seedOrder(stockCount: number, orderQuantity: number) {
    const [owner] = await db
      .insert(user)
      .values({
        id: randomUUID(),
        name: 'Owner',
        email: `owner-${randomUUID()}@example.com`,
        role: 'creator',
        emailVerified: true,
      })
      .returning()

    const [shopRecord] = await db
      .insert(shop)
      .values({ id: randomUUID(), name: 'S', slug: `s-${randomUUID()}`, ownerId: owner.id })
      .returning()

    const [prod] = await db
      .insert(product)
      .values({
        id: randomUUID(),
        name: 'Vase',
        slug: `vase-${randomUUID()}`,
        priceCents: 1000,
        shopId: shopRecord.id,
        stockCount,
      })
      .returning()

    const [po] = await db
      .insert(platformOrder)
      .values({
        id: randomUUID(),
        userId: owner.id,
        shippingAddress: { name: 'B', country: 'FR' },
        billingAddress: { name: 'B', country: 'FR' },
        totalCents: 1000,
        status: 'paid',
      })
      .returning()

    const [so] = await db
      .insert(shopOrder)
      .values({ id: randomUUID(), platformOrderId: po.id, shopId: shopRecord.id, status: 'paid' })
      .returning()

    await db.insert(orderItem).values({
      id: randomUUID(),
      shopOrderId: so.id,
      productId: prod.id,
      productName: 'Vase',
      unitPriceCents: 1000,
      quantity: orderQuantity,
      totalCents: 1000 * orderQuantity,
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
    })

    return { product: prod, platformOrder: po }
  }

  it('decrements normally when stock covers the order', async () => {
    const { product: prod, platformOrder: po } = await seedOrder(5, 2)

    await db.transaction(async (tx) => {
      await decrementStockForPaidOrder(tx, po.id)
    })

    const [updated] = await db.select().from(product).where(eq(product.id, prod.id))
    expect(updated.stockCount).toBe(3)
  })

  it('clamps rather than failing when the payment is already captured', async () => {
    // Throwing here would fail the payment webhook and leave money captured
    // against an unprocessed order, which is worse than a flagged oversell.
    const { product: prod, platformOrder: po } = await seedOrder(1, 3)

    await db.transaction(async (tx) => {
      await decrementStockForPaidOrder(tx, po.id)
    })

    const [updated] = await db.select().from(product).where(eq(product.id, prod.id))
    expect(updated.stockCount).toBe(0)
  })

  it('refuses to oversell when the caller can still cancel and refund', async () => {
    const { product: prod, platformOrder: po } = await seedOrder(1, 3)

    await expect(
      db.transaction(async (tx) => {
        await decrementStockForPaidOrder(tx, po.id, { rejectOnShortfall: true })
      }),
    ).rejects.toThrow(/only 1 available/)

    // The transaction rolled back, so stock is untouched.
    const [updated] = await db.select().from(product).where(eq(product.id, prod.id))
    expect(updated.stockCount).toBe(1)
  })

  it('allows an exactly-sufficient order under rejectOnShortfall', async () => {
    const { product: prod, platformOrder: po } = await seedOrder(3, 3)

    await db.transaction(async (tx) => {
      await decrementStockForPaidOrder(tx, po.id, { rejectOnShortfall: true })
    })

    const [updated] = await db.select().from(product).where(eq(product.id, prod.id))
    expect(updated.stockCount).toBe(0)
  })
})
