import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { inventoryReservation, platformOrder, product, shop, user } from '#/db/schema'

import { InsufficientStockError, releaseStock, reserveStock } from './inventory.server'

beforeEach(async () => {
  await db.delete(inventoryReservation)
  await db.delete(platformOrder)
  await db.delete(product)
  await db.delete(shop)
  await db.delete(user)
})

describe('reserveStock', () => {
  async function seedProduct(stockCount: number) {
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
        stockCount,
      })
      .returning()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: u.id,
        shippingAddress: { street: '123 Main' },
        totalCents: 2999,
        status: 'pending',
      })
      .returning()

    return { user: u, shop: s, product: p, order }
  }

  it('creates a reservation when stock is available', async () => {
    const { product: p, order } = await seedProduct(10)
    const expiresAt = new Date(Date.now() + 60_000)

    await reserveStock(p.id, order.id, 3, expiresAt)

    const reservations = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.platformOrderId, order.id))

    expect(reservations).toHaveLength(1)
    expect(reservations[0].productId).toBe(p.id)
    expect(reservations[0].quantity).toBe(3)
    expect(reservations[0].expiresAt.getTime()).toBe(expiresAt.getTime())
  })

  it('updates an existing reservation for the same product + order', async () => {
    const { product: p, order } = await seedProduct(10)
    const firstExpiry = new Date(Date.now() + 60_000)
    const secondExpiry = new Date(Date.now() + 120_000)

    await reserveStock(p.id, order.id, 2, firstExpiry)
    await reserveStock(p.id, order.id, 5, secondExpiry)

    const reservations = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.platformOrderId, order.id))

    expect(reservations).toHaveLength(1)
    expect(reservations[0].quantity).toBe(5)
    expect(reservations[0].expiresAt.getTime()).toBe(secondExpiry.getTime())
  })

  it('allows reservations from different orders for the same product', async () => {
    const { product: p, order: order1 } = await seedProduct(10)
    const [order2] = await db
      .insert(platformOrder)
      .values({
        userId: order1.userId,
        shippingAddress: { street: '456 Oak' },
        totalCents: 2999,
        status: 'pending',
      })
      .returning()

    const expiresAt = new Date(Date.now() + 60_000)
    await reserveStock(p.id, order1.id, 3, expiresAt)
    await reserveStock(p.id, order2.id, 4, expiresAt)

    const reservations = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.productId, p.id))

    expect(reservations).toHaveLength(2)
    expect(reservations.reduce((sum, r) => sum + r.quantity, 0)).toBe(7)
  })

  it('throws InsufficientStockError when requested quantity exceeds available stock', async () => {
    const { product: p, order } = await seedProduct(5)
    const expiresAt = new Date(Date.now() + 60_000)

    await expect(reserveStock(p.id, order.id, 10, expiresAt)).rejects.toThrow(
      InsufficientStockError,
    )

    try {
      await reserveStock(p.id, order.id, 10, expiresAt)
    } catch (err) {
      expect(err).toBeInstanceOf(InsufficientStockError)
      expect((err as InsufficientStockError).availableQuantity).toBe(5)
      expect((err as InsufficientStockError).requestedQuantity).toBe(10)
    }
  })

  it('throws InsufficientStockError with correct available quantity when partial reservations exist', async () => {
    const { product: p, order: order1 } = await seedProduct(10)
    const [order2] = await db
      .insert(platformOrder)
      .values({
        userId: order1.userId,
        shippingAddress: { street: '456 Oak' },
        totalCents: 2999,
        status: 'pending',
      })
      .returning()

    const expiresAt = new Date(Date.now() + 60_000)
    await reserveStock(p.id, order1.id, 7, expiresAt)

    await expect(reserveStock(p.id, order2.id, 5, expiresAt)).rejects.toThrow(
      InsufficientStockError,
    )

    try {
      await reserveStock(p.id, order2.id, 5, expiresAt)
    } catch (err) {
      expect(err).toBeInstanceOf(InsufficientStockError)
      expect((err as InsufficientStockError).availableQuantity).toBe(3)
    }
  })

  it('rejects reservation when product does not exist', async () => {
    const { order } = await seedProduct(10)
    const expiresAt = new Date(Date.now() + 60_000)

    await expect(reserveStock('nonexistent-product', order.id, 1, expiresAt)).rejects.toThrow(
      'Product nonexistent-product not found',
    )
  })

  it('rejects non-positive quantity', async () => {
    const { product: p, order } = await seedProduct(10)
    const expiresAt = new Date(Date.now() + 60_000)

    await expect(reserveStock(p.id, order.id, 0, expiresAt)).rejects.toThrow(
      'Quantity must be greater than 0',
    )
    await expect(reserveStock(p.id, order.id, -1, expiresAt)).rejects.toThrow(
      'Quantity must be greater than 0',
    )
  })

  it('prevents concurrent overselling (race condition)', async () => {
    const { product: p } = await seedProduct(1)

    // Create two separate orders from the same user
    const [order1] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: { street: '123 Main' },
        totalCents: 2999,
        status: 'pending',
      })
      .returning()

    const [order2] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: { street: '456 Oak' },
        totalCents: 2999,
        status: 'pending',
      })
      .returning()

    const expiresAt = new Date(Date.now() + 60_000)

    // Attempt both reservations concurrently
    const results = await Promise.allSettled([
      reserveStock(p.id, order1.id, 1, expiresAt),
      reserveStock(p.id, order2.id, 1, expiresAt),
    ])

    const successes = results.filter((r) => r.status === 'fulfilled')
    const failures = results.filter((r) => r.status === 'rejected')

    expect(successes).toHaveLength(1)
    expect(failures).toHaveLength(1)

    const failure = failures[0] as PromiseRejectedResult
    expect(failure.reason).toBeInstanceOf(InsufficientStockError)

    // Verify only one reservation persists
    const reservations = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.productId, p.id))

    expect(reservations).toHaveLength(1)
    expect(reservations[0].quantity).toBe(1)
  })

  it('ignores expired reservations when calculating available stock', async () => {
    const { product: p, order: order1 } = await seedProduct(10)
    const [order2] = await db
      .insert(platformOrder)
      .values({
        userId: order1.userId,
        shippingAddress: { street: '456 Oak' },
        totalCents: 2999,
        status: 'pending',
      })
      .returning()

    // Insert an expired reservation manually
    await db.insert(inventoryReservation).values({
      productId: p.id,
      platformOrderId: order1.id,
      quantity: 8,
      expiresAt: new Date(Date.now() - 60_000),
    })

    const expiresAt = new Date(Date.now() + 60_000)
    // Should succeed because the old reservation is expired
    await reserveStock(p.id, order2.id, 10, expiresAt)

    const reservations = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.productId, p.id))

    expect(reservations).toHaveLength(2)
  })
})

describe('releaseStock', () => {
  async function seedReservation() {
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

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: u.id,
        shippingAddress: { street: '123 Main' },
        totalCents: 2999,
        status: 'pending',
      })
      .returning()

    await db.insert(inventoryReservation).values({
      productId: p.id,
      platformOrderId: order.id,
      quantity: 3,
      expiresAt: new Date(Date.now() + 60_000),
    })

    return { product: p, order }
  }

  it('deletes all reservations for a platform order', async () => {
    const { order } = await seedReservation()

    await releaseStock(order.id)

    const reservations = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.platformOrderId, order.id))

    expect(reservations).toHaveLength(0)
  })

  it('is safe to call when no reservations exist', async () => {
    const [u] = await db
      .insert(user)
      .values({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        emailVerified: true,
      })
      .returning()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: u.id,
        shippingAddress: { street: '123 Main' },
        totalCents: 0,
        status: 'pending',
      })
      .returning()

    await expect(releaseStock(order.id)).resolves.toBeUndefined()
  })

  it('deletes only reservations for the specified order', async () => {
    const { product: p, order: order1 } = await seedReservation()

    const [order2] = await db
      .insert(platformOrder)
      .values({
        userId: order1.userId,
        shippingAddress: { street: '456 Oak' },
        totalCents: 2999,
        status: 'pending',
      })
      .returning()

    await db.insert(inventoryReservation).values({
      productId: p.id,
      platformOrderId: order2.id,
      quantity: 2,
      expiresAt: new Date(Date.now() + 60_000),
    })

    await releaseStock(order1.id)

    const remaining = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.productId, p.id))

    expect(remaining).toHaveLength(1)
    expect(remaining[0].platformOrderId).toBe(order2.id)
  })
})
