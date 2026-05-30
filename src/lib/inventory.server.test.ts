import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import { inventoryReservation, platformOrder, product, shop, user } from '#/db/schema'

import { releaseExpiredReservations } from './inventory.server'

describe('releaseExpiredReservations (inArray batch delete)', () => {
  beforeEach(async () => {
    await db.delete(inventoryReservation)
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
