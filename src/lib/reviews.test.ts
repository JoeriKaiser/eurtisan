import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import {
  notification,
  orderItem,
  platformOrder,
  product,
  review,
  reviewHelpfulVote,
  reviewReport,
  sellerReply,
  sellerReplyReport,
  shop,
  shopOrder,
  user,
} from '#/db/schema'

import type { NotificationType } from './notifications.server'
import {
  createReviewQuery,
  createSellerReplyQuery,
  getAdminReviewsQuery,
  getAdminSellerRepliesQuery,
  getProductReviewsQuery,
  getReviewableItemsQuery,
  getReviewReportsQuery,
  getSellerReplyReportsQuery,
  reportReviewQuery,
  reportSellerReplyQuery,
  setReviewHelpfulQuery,
  updateReviewModerationStatusQuery,
  updateSellerReplyModerationStatusQuery,
  updateSellerReplyQuery,
} from './reviews.server'
beforeEach(async () => {
  await db.delete(notification)
  await db.delete(reviewHelpfulVote)
  await db.delete(review)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(product)
  await db.delete(shop)
  await db.delete(user)
})

afterAll(async () => {
  await db.delete(notification)
  await db.delete(reviewHelpfulVote)
  await db.delete(review)
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

describe('getReviewableItemsQuery', () => {
  it('returns null for nonexistent order', async () => {
    const result = await getReviewableItemsQuery('550e8400-e29b-41d4-a716-446655440000', 'user-1')
    expect(result).toBeNull()
  })

  it('returns null when order belongs to another user', async () => {
    await seedUser()
    await seedShop()
    const otherUser = await seedUser({
      id: 'user-2',
      name: 'Other',
      email: 'other@example.com',
    })

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: otherUser.id,
        shippingAddress: {
          name: 'Other',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Other',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()

    const result = await getReviewableItemsQuery(order.id, 'user-1')
    expect(result).toBeNull()
  })

  it('returns items with eligibility info', async () => {
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
          postalCode: '12345',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        totalCents: 2500,
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
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
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

    const result = await getReviewableItemsQuery(order.id, 'user-1')
    expect(result).not.toBeNull()
    expect(result?.items).toHaveLength(1)
    expect(result?.items[0].productId).toBe(p.id)
    expect(result?.items[0].isEligible).toBe(true)
    expect(result?.items[0].daysRemaining).toBeNull()
    expect(result?.items[0].hasReview).toBe(false)
  })

  it('marks items not eligible when within 14 days', async () => {
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
          postalCode: '12345',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        totalCents: 2500,
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
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
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

    const result = await getReviewableItemsQuery(order.id, 'user-1')
    expect(result?.items[0].isEligible).toBe(false)
    expect(result?.items[0].daysRemaining).toBeGreaterThan(0)
    expect(result?.items[0].daysRemaining).toBeLessThanOrEqual(12)
  })

  it('marks hasReview true when review exists', async () => {
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
          postalCode: '12345',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        totalCents: 2500,
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
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
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

    await db.insert(review).values({
      shopOrderId: so.id,
      productId: p.id,
      buyerUserId: 'user-1',
      rating: 5,
      comment: 'Great!',
    })

    const result = await getReviewableItemsQuery(order.id, 'user-1')
    expect(result?.items[0].hasReview).toBe(true)
    expect(result?.items[0].isEligible).toBe(true)
  })

  it('handles mixed shop orders where some are not delivered', async () => {
    await seedUser()
    await seedShop()
    const shop2 = await db
      .insert(shop)
      .values({ id: 'shop-2', name: 'Second Shop', slug: 'second-shop', ownerId: 'user-1' })
      .returning()
      .then((rows) => rows[0])
    const p1 = await seedProduct({ id: 'prod-1' })
    const p2 = await seedProduct({ id: 'prod-2', name: 'Bowl', slug: 'bowl', shopId: shop2.id })

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        totalCents: 4500,
      })
      .returning()

    const [so1] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 2000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      })
      .returning()

    const [so2] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: shop2.id,
        shippingMethod: 'express',
        shippingCostCents: 1000,
        subtotalCents: 2000,
        status: 'shipped',
      })
      .returning()

    await db.insert(orderItem).values([
      {
        shopOrderId: so1.id,
        productId: p1.id,
        productName: p1.name,
        unitPriceCents: p1.priceCents,
        quantity: 2,
        totalCents: 2000,
      },
      {
        shopOrderId: so2.id,
        productId: p2.id,
        productName: p2.name,
        unitPriceCents: p2.priceCents,
        quantity: 1,
        totalCents: 2000,
      },
    ])

    const result = await getReviewableItemsQuery(order.id, 'user-1')
    expect(result).not.toBeNull()
    expect(result?.items).toHaveLength(2)

    const item1 = result?.items.find((i) => i.productId === p1.id)
    const item2 = result?.items.find((i) => i.productId === p2.id)

    expect(item1?.isEligible).toBe(true)
    expect(item1?.daysRemaining).toBeNull()

    expect(item2?.isEligible).toBe(false)
    expect(item2?.daysRemaining).toBeNull()
    expect(item2?.deliveredAt).toBeNull()
  })
})

describe('createReviewQuery', () => {
  it('throws 404 for nonexistent shop order', async () => {
    try {
      await createReviewQuery('550e8400-e29b-41d4-a716-446655440000', 'prod-1', 'user-1', 5, null)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(404)
    }
  })

  it('throws 403 when order belongs to another user', async () => {
    await seedUser()
    await seedShop()
    const otherUser = await seedUser({
      id: 'user-2',
      name: 'Other',
      email: 'other@example.com',
    })

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: otherUser.id,
        shippingAddress: {
          name: 'Other',
          street: 'St',
          city: 'City',
          postalCode: '00000',
          country: 'DE',
        },
        billingAddress: {
          name: 'Other',
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
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      })
      .returning()

    try {
      await createReviewQuery(so.id, 'prod-1', 'user-1', 5, null)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(403)
    }
  })

  it('throws 403 when buyer is the shop owner (self-purchase)', async () => {
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
          postalCode: '12345',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
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
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      })
      .returning()

    try {
      await createReviewQuery(so.id, p.id, 'user-1', 5, null)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(403)
      const body = await (err as Response).json()
      expect(body.message).toContain('own')
    }
  })

  it('throws 403 when order is not delivered', async () => {
    await seedUser()
    await seedShop()
    await seedProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
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
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'shipped',
      })
      .returning()

    try {
      await createReviewQuery(so.id, 'prod-1', 'user-1', 5, null)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(403)
    }
  })

  it('throws 403 with daysRemaining when before eligibility period', async () => {
    await seedUser()
    await seedUser({ id: 'user-2', name: 'Owner', email: 'owner@example.com' })
    await seedShop({ ownerId: 'user-2' })
    await seedProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
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
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      })
      .returning()

    try {
      await createReviewQuery(so.id, 'prod-1', 'user-1', 5, null)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(403)
      const body = await (err as Response).json()
      expect(body.daysRemaining).toBeGreaterThan(0)
      expect(body.daysRemaining).toBeLessThanOrEqual(12)
    }
  })

  it('throws 409 when duplicate review is attempted', async () => {
    await seedUser()
    await seedUser({ id: 'user-2', name: 'Owner', email: 'owner@example.com' })
    await seedShop({ ownerId: 'user-2' })
    const p = await seedProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
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
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      })
      .returning()

    await db.insert(review).values({
      shopOrderId: so.id,
      productId: p.id,
      buyerUserId: 'user-1',
      rating: 4,
      comment: 'Good',
    })

    try {
      await createReviewQuery(so.id, p.id, 'user-1', 5, null)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err instanceof Response).toBe(true)
      expect((err as Response).status).toBe(409)
    }
  })

  it('creates a review when all conditions are met', async () => {
    await seedUser()
    await seedUser({ id: 'user-2', name: 'Owner', email: 'owner@example.com' })
    await seedShop({ ownerId: 'user-2' })
    const p = await seedProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
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
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      })
      .returning()

    const result = await createReviewQuery(so.id, p.id, 'user-1', 5, 'Amazing product!')

    expect(result.id).toBeDefined()
    expect(result.shopOrderId).toBe(so.id)
    expect(result.productId).toBe(p.id)
    expect(result.rating).toBe(5)
    expect(result.comment).toBe('Amazing product!')
    expect(result.createdAt).toBeDefined()

    const dbReview = await db.select().from(review).where(eq(review.id, result.id))
    expect(dbReview).toHaveLength(1)
    expect(dbReview[0].rating).toBe(5)
    expect(dbReview[0].comment).toBe('Amazing product!')
    expect(dbReview[0].buyerUserId).toBe('user-1')
  })

  it('sanitizes HTML in comments', async () => {
    await seedUser()
    await seedUser({ id: 'user-2', name: 'Owner', email: 'owner@example.com' })
    await seedShop({ ownerId: 'user-2' })
    const p = await seedProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
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
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      })
      .returning()

    const result = await createReviewQuery(
      so.id,
      p.id,
      'user-1',
      4,
      '<script>alert("xss")</script>',
    )
    expect(result.comment).toBeNull()
  })

  it('allows null comment', async () => {
    await seedUser()
    await seedUser({ id: 'user-2', name: 'Owner', email: 'owner@example.com' })
    await seedShop({ ownerId: 'user-2' })
    const p = await seedProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        billingAddress: {
          name: 'Test',
          street: 'St',
          city: 'City',
          postalCode: '12345',
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
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      })
      .returning()

    const result = await createReviewQuery(so.id, p.id, 'user-1', 3, null)
    expect(result.comment).toBeNull()
  })
})

describe('getProductReviewsQuery', () => {
  it('returns empty result when no reviews exist', async () => {
    const result = await getProductReviewsQuery('prod-1', 1, 10)
    expect(result.reviews).toEqual([])
    expect(result.total).toBe(0)
    expect(result.averageRating).toBeNull()
    expect(result.distribution).toEqual([
      { rating: 5, count: 0 },
      { rating: 4, count: 0 },
      { rating: 3, count: 0 },
      { rating: 2, count: 0 },
      { rating: 1, count: 0 },
    ])
    expect(result.totalPages).toBe(0)
  })

  it('returns reviews ordered by newest first with buyer names', async () => {
    await db.insert(user).values([
      { id: 'user-1', name: 'Alice', email: 'alice@example.com', emailVerified: true },
      { id: 'user-2', name: 'Bob', email: 'bob@example.com', emailVerified: true },
    ])

    await db.insert(shop).values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: 'user-1',
    })

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 1000,
      shopId: 'shop-1',
    })

    // Create two separate orders/shop-orders so each review has a unique (shopOrderId, productId)
    const [order1] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-1',
        shippingAddress: {
          name: 'Alice',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        billingAddress: {
          name: 'Alice',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()

    const [so1] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order1.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      })
      .returning()

    const [order2] = await db
      .insert(platformOrder)
      .values({
        userId: 'user-2',
        shippingAddress: {
          name: 'Bob',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        billingAddress: {
          name: 'Bob',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()

    const [so2] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order2.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      })
      .returning()

    await db.insert(review).values([
      {
        shopOrderId: so1.id,
        productId: 'prod-1',
        buyerUserId: 'user-1',
        rating: 5,
        comment: 'Great!',
        createdAt: new Date('2024-01-02'),
      },
      {
        shopOrderId: so2.id,
        productId: 'prod-1',
        buyerUserId: 'user-2',
        rating: 3,
        comment: 'Okay',
        createdAt: new Date('2024-01-03'),
      },
    ])

    const result = await getProductReviewsQuery('prod-1', 1, 10)
    expect(result.reviews).toHaveLength(2)
    expect(result.reviews[0].buyerName).toBe('Bob')
    expect(result.reviews[0].rating).toBe(3)
    expect(result.reviews[1].buyerName).toBe('Alice')
    expect(result.reviews[1].rating).toBe(5)
    expect(result.total).toBe(2)
    expect(result.averageRating).toBe(4.0)
    expect(result.reviews.every((r) => 'buyerName' in r && !('buyerUserId' in r))).toBe(true)
  })

  it('paginates results correctly', async () => {
    await db
      .insert(user)
      .values([{ id: 'user-1', name: 'Alice', email: 'alice@example.com', emailVerified: true }])

    await db.insert(shop).values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: 'user-1',
    })

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 1000,
      shopId: 'shop-1',
    })

    // Create a separate shop-order per review to respect the unique constraint
    for (let i = 0; i < 12; i++) {
      const [order] = await db
        .insert(platformOrder)
        .values({
          userId: 'user-1',
          shippingAddress: {
            name: 'Alice',
            street: 'St',
            city: 'City',
            postalCode: '12345',
            country: 'DE',
          },
          billingAddress: {
            name: 'Alice',
            street: 'St',
            city: 'City',
            postalCode: '12345',
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
          shippingCostCents: 500,
          subtotalCents: 1000,
          status: 'delivered',
          deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        })
        .returning()

      await db.insert(review).values({
        shopOrderId: so.id,
        productId: 'prod-1',
        buyerUserId: 'user-1',
        rating: (i % 5) + 1,
        comment: `Review ${i}`,
      })
    }

    const page1 = await getProductReviewsQuery('prod-1', 1, 10)
    expect(page1.reviews).toHaveLength(10)
    expect(page1.total).toBe(12)
    expect(page1.totalPages).toBe(2)
    expect(page1.page).toBe(1)

    const page2 = await getProductReviewsQuery('prod-1', 2, 10)
    expect(page2.reviews).toHaveLength(2)
    expect(page2.page).toBe(2)
  })

  it('calculates rating distribution correctly', async () => {
    await db
      .insert(user)
      .values([{ id: 'user-1', name: 'Alice', email: 'alice@example.com', emailVerified: true }])

    await db.insert(shop).values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: 'user-1',
    })

    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 1000,
      shopId: 'shop-1',
    })

    // Create a separate shop-order per review to respect the unique constraint
    const ratings = [5, 5, 4, 3, 1]
    for (const rating of ratings) {
      const [order] = await db
        .insert(platformOrder)
        .values({
          userId: 'user-1',
          shippingAddress: {
            name: 'Alice',
            street: 'St',
            city: 'City',
            postalCode: '12345',
            country: 'DE',
          },
          billingAddress: {
            name: 'Alice',
            street: 'St',
            city: 'City',
            postalCode: '12345',
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
          shippingCostCents: 500,
          subtotalCents: 1000,
          status: 'delivered',
          deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        })
        .returning()

      await db.insert(review).values({
        shopOrderId: so.id,
        productId: 'prod-1',
        buyerUserId: 'user-1',
        rating,
      })
    }

    const result = await getProductReviewsQuery('prod-1', 1, 10)
    expect(result.averageRating).toBe(3.6)
    expect(result.distribution).toEqual([
      { rating: 5, count: 2 },
      { rating: 4, count: 1 },
      { rating: 3, count: 1 },
      { rating: 2, count: 0 },
      { rating: 1, count: 1 },
    ])
  })

  it('validates page and pageSize boundaries', async () => {
    const result = await getProductReviewsQuery('prod-1', 0, 0)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(1)
    expect(result.totalPages).toBe(0)
  })

  it('orders deterministically, filters aggregate totals, and keeps helpful votes private', async () => {
    const address = {
      name: 'Buyer',
      street: 'Street',
      city: 'City',
      postalCode: '12345',
      country: 'DE',
    }
    await db.insert(user).values([
      { id: 'owner', name: 'Owner', email: 'owner@example.com', emailVerified: true },
      { id: 'buyer-a', name: 'A', email: 'a@example.com', emailVerified: true },
      { id: 'buyer-b', name: 'B', email: 'b@example.com', emailVerified: true },
      { id: 'buyer-c', name: 'C', email: 'c@example.com', emailVerified: true },
      { id: 'buyer-d', name: 'D', email: 'd@example.com', emailVerified: true },
      { id: 'viewer', name: 'Viewer', email: 'viewer@example.com', emailVerified: true },
      { id: 'voter-2', name: 'Voter 2', email: 'voter2@example.com', emailVerified: true },
      { id: 'voter-3', name: 'Voter 3', email: 'voter3@example.com', emailVerified: true },
    ])
    await db.insert(shop).values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: 'owner',
      status: 'active',
    })
    await db.insert(product).values({
      id: 'prod-1',
      name: 'Vase',
      slug: 'vase',
      priceCents: 1000,
      shopId: 'shop-1',
      status: 'published',
      isActive: true,
    })

    async function addReview(id: string, buyerUserId: string, rating: number, createdAt: Date) {
      const [order] = await db
        .insert(platformOrder)
        .values({
          userId: buyerUserId,
          shippingAddress: address,
          billingAddress: address,
          totalCents: 1000,
        })
        .returning()
      const [shopOrderRecord] = await db
        .insert(shopOrder)
        .values({
          platformOrderId: order.id,
          shopId: 'shop-1',
          shippingMethod: 'standard',
          shippingCostCents: 500,
          subtotalCents: 1000,
          status: 'delivered',
          deliveredAt: new Date('2025-12-01T00:00:00Z'),
        })
        .returning()
      await db.insert(review).values({
        id,
        shopOrderId: shopOrderRecord.id,
        productId: 'prod-1',
        buyerUserId,
        rating,
        createdAt,
      })
    }

    const first = '00000000-0000-4000-8000-000000000001'
    const second = '00000000-0000-4000-8000-000000000002'
    const third = '00000000-0000-4000-8000-000000000003'
    const fourth = '00000000-0000-4000-8000-000000000004'
    await addReview(first, 'buyer-a', 3, new Date('2026-01-01T00:00:00Z'))
    await addReview(second, 'buyer-b', 5, new Date('2026-01-02T00:00:00Z'))
    await addReview(third, 'buyer-c', 5, new Date('2026-01-02T00:00:00Z'))
    await addReview(fourth, 'buyer-d', 1, new Date('2026-01-03T00:00:00Z'))

    await setReviewHelpfulQuery(first, 'viewer', true)
    await setReviewHelpfulQuery(first, 'voter-2', true)
    await setReviewHelpfulQuery(first, 'voter-3', true)
    await setReviewHelpfulQuery(second, 'voter-2', true)

    const newest = await getProductReviewsQuery('prod-1', 1, 10, 'newest', undefined, 'viewer')
    expect(newest.reviews.map((r) => r.id)).toEqual([fourth, third, second, first])
    expect(newest.sort).toBe('newest')
    expect(newest.ratingFilter).toBeNull()
    expect(newest.reviews.find((r) => r.id === first)).toMatchObject({
      helpfulCount: 3,
      viewerHasMarkedHelpful: true,
      canMarkHelpful: true,
    })
    expect(newest.reviews.every((r) => !('voterUserId' in r))).toBe(true)

    const highest = await getProductReviewsQuery('prod-1', 1, 10, 'highest')
    expect(highest.reviews.map((r) => r.id)).toEqual([third, second, first, fourth])
    const lowest = await getProductReviewsQuery('prod-1', 1, 10, 'lowest')
    expect(lowest.reviews.map((r) => r.id)).toEqual([fourth, first, third, second])
    const helpful = await getProductReviewsQuery('prod-1', 1, 10, 'helpful')
    expect(helpful.reviews.map((r) => r.id)).toEqual([first, second, fourth, third])

    const filteredPageOne = await getProductReviewsQuery('prod-1', 1, 1, 'highest', 5)
    expect(filteredPageOne).toMatchObject({
      total: 2,
      totalPages: 2,
      page: 1,
      ratingFilter: 5,
      averageRating: 5,
      distribution: [
        { rating: 5, count: 2 },
        { rating: 4, count: 0 },
        { rating: 3, count: 0 },
        { rating: 2, count: 0 },
        { rating: 1, count: 0 },
      ],
    })
    expect(filteredPageOne.reviews.map((r) => r.id)).toEqual([third])
    const filteredPageTwo = await getProductReviewsQuery('prod-1', 2, 1, 'highest', 5)
    expect(filteredPageTwo.reviews.map((r) => r.id)).toEqual([second])

    expect(await setReviewHelpfulQuery(second, 'viewer', true)).toEqual({
      helpfulCount: 2,
      viewerHasMarkedHelpful: true,
    })
    expect(await setReviewHelpfulQuery(second, 'viewer', true)).toEqual({
      helpfulCount: 2,
      viewerHasMarkedHelpful: true,
    })
    expect(await setReviewHelpfulQuery(second, 'viewer', false)).toEqual({
      helpfulCount: 1,
      viewerHasMarkedHelpful: false,
    })
    expect(await setReviewHelpfulQuery(second, 'viewer', false)).toEqual({
      helpfulCount: 1,
      viewerHasMarkedHelpful: false,
    })
    await expect(setReviewHelpfulQuery(first, 'buyer-a', true)).rejects.toMatchObject({
      status: 403,
    })
    await expect(setReviewHelpfulQuery(first, 'owner', true)).rejects.toMatchObject({ status: 403 })

    await db.update(product).set({ isActive: false }).where(eq(product.id, 'prod-1'))
    await expect(setReviewHelpfulQuery(third, 'viewer', true)).rejects.toMatchObject({
      status: 404,
    })
  })
})

describe('review moderation and flagging', () => {
  /** A delivered order with one review on it, ready to be reported. */
  async function seedReview(rating = 5) {
    const buyer = await seedUser()
    const s = await seedShop()
    const p = await seedProduct()
    const address = {
      name: 'Alice',
      street: 'St',
      city: 'City',
      postalCode: '12345',
      country: 'DE',
    }
    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: buyer.id,
        shippingAddress: address,
        billingAddress: address,
        totalCents: 1000,
      })
      .returning()
    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: s.id,
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      })
      .returning()
    const [r] = await db
      .insert(review)
      .values({
        shopOrderId: so.id,
        productId: p.id,
        buyerUserId: buyer.id,
        rating,
        comment: 'Excellent!',
      })
      .returning()

    return { buyer, shop: s, product: p, review: r }
  }

  /** A user other than the review's author, since authors cannot report. */
  async function seedReporter(suffix: string) {
    return seedUser({ id: `reporter-${suffix}`, email: `reporter-${suffix}@example.com` })
  }

  it('records a report without touching the review', async () => {
    // The regression that matters: reporting used to set `flagged`, which
    // silently removed the review from the product's `popularityScore` while
    // leaving it on the page. One click moved search ranking.
    const { review: r } = await seedReview()
    const reporter = await seedReporter('a')

    expect(r.moderationStatus).toBe('approved')

    const result = await reportReviewQuery(r.id, reporter.id, 'not_authentic', null)
    expect(result.alreadyReported).toBe(false)

    const [unchanged] = await db.select().from(review).where(eq(review.id, r.id))
    expect(unchanged.moderationStatus).toBe('approved')

    const reports = await db.select().from(reviewReport).where(eq(reviewReport.reviewId, r.id))
    expect(reports).toHaveLength(1)
    expect(reports[0].reason).toBe('not_authentic')
    expect(reports[0].status).toBe('open')
  })

  it('keeps one notice per person rather than erroring', async () => {
    const { review: r } = await seedReview()
    const reporter = await seedReporter('a')

    await reportReviewQuery(r.id, reporter.id, 'spam', null)
    const second = await reportReviewQuery(r.id, reporter.id, 'offensive', 'again')

    expect(second.alreadyReported).toBe(true)
    const reports = await db.select().from(reviewReport).where(eq(reviewReport.reviewId, r.id))
    expect(reports).toHaveLength(1)
    // The first notice stands; a repeat does not overwrite its ground.
    expect(reports[0].reason).toBe('spam')
  })

  it('counts notices from different people separately', async () => {
    const { review: r } = await seedReview()
    const [first, second] = [await seedReporter('a'), await seedReporter('b')]

    await reportReviewQuery(r.id, first.id, 'not_authentic', null)
    await reportReviewQuery(r.id, second.id, 'not_authentic', null)

    const counts = await getReviewReportsQuery([r.id])
    expect(counts.get(r.id)).toBe(2)
  })

  it('refuses to let an author report their own review', async () => {
    const { review: r, buyer } = await seedReview()

    await expect(reportReviewQuery(r.id, buyer.id, 'other', 'x')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('rejects a report for a review that does not exist', async () => {
    const reporter = await seedReporter('a')
    await expect(
      reportReviewQuery('00000000-0000-0000-0000-000000000000', reporter.id, 'spam', null),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('shows the moderation queue how many notices a review has', async () => {
    // Admins previously saw `flagged` with no record of who reported it or why.
    const { review: r } = await seedReview()
    const reporter = await seedReporter('a')
    await reportReviewQuery(r.id, reporter.id, 'personal_data', 'contains an address')

    const result = await getAdminReviewsQuery('all', 1, 100)
    const row = result.reviews.find((entry) => entry.id === r.id)
    expect(row?.openReports).toBe(1)
  })

  it('filters out hidden reviews from product reviews', async () => {
    const buyer = await seedUser()
    const s = await seedShop()
    const p = await seedProduct()
    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: buyer.id,
        shippingAddress: {
          name: 'Alice',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        billingAddress: {
          name: 'Alice',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()
    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: s.id,
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      })
      .returning()

    const [r1] = await db
      .insert(review)
      .values({
        shopOrderId: so.id,
        productId: p.id,
        buyerUserId: buyer.id,
        rating: 5,
        comment: 'Visible review',
        moderationStatus: 'approved',
      })
      .returning()

    const [order2] = await db
      .insert(platformOrder)
      .values({
        userId: buyer.id,
        shippingAddress: {
          name: 'Alice',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        billingAddress: {
          name: 'Alice',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()
    const [so2] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order2.id,
        shopId: s.id,
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      })
      .returning()

    await db.insert(review).values({
      shopOrderId: so2.id,
      productId: p.id,
      buyerUserId: buyer.id,
      rating: 1,
      comment: 'Hidden review',
      moderationStatus: 'hidden',
    })

    const result = await getProductReviewsQuery(p.id, 1, 10)
    expect(result.reviews).toHaveLength(1)
    expect(result.reviews[0].id).toBe(r1.id)
    expect(result.averageRating).toBe(5)
  })

  it('admin queries and status updates work correctly', async () => {
    const buyer = await seedUser()
    const s = await seedShop()
    const p = await seedProduct()
    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: buyer.id,
        shippingAddress: {
          name: 'Alice',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        billingAddress: {
          name: 'Alice',
          street: 'St',
          city: 'City',
          postalCode: '12345',
          country: 'DE',
        },
        totalCents: 1000,
      })
      .returning()
    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: s.id,
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      })
      .returning()
    const [r] = await db
      .insert(review)
      .values({
        shopOrderId: so.id,
        productId: p.id,
        buyerUserId: buyer.id,
        rating: 4,
        comment: 'Comment',
        moderationStatus: 'flagged',
      })
      .returning()

    const flaggedResult = await getAdminReviewsQuery('flagged', 1, 10)
    expect(flaggedResult.reviews).toHaveLength(1)
    expect(flaggedResult.reviews[0].id).toBe(r.id)

    await updateReviewModerationStatusQuery(r.id, 'hidden', {
      ground: 'terms',
      explanation: 'Off-topic',
      actorUserId: buyer.id,
    })
    const [updated] = await db.select().from(review).where(eq(review.id, r.id))
    expect(updated.moderationStatus).toBe('hidden')
  })
})

describe('moderation decisions notify the people entitled to know', () => {
  /** A review by `author`, reported by `reporter`, ready to be decided on. */
  async function seedReportedReview() {
    const author = await seedUser()
    const s = await seedShop()
    const p = await seedProduct()
    const address = { name: 'A', street: 'St', city: 'City', postalCode: '1', country: 'DE' }
    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: author.id,
        shippingAddress: address,
        billingAddress: address,
        totalCents: 1000,
      })
      .returning()
    const [so] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: s.id,
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      })
      .returning()
    const [r] = await db
      .insert(review)
      .values({ shopOrderId: so.id, productId: p.id, buyerUserId: author.id, rating: 1 })
      .returning()

    const reporter = await seedUser({ id: 'reporter-1', email: 'reporter-1@example.com' })
    const admin = await seedUser({ id: 'admin-1', email: 'admin-1@example.com', role: 'admin' })
    await reportReviewQuery(r.id, reporter.id, 'not_authentic', 'suspicious')

    return { author, reporter, admin, review: r }
  }

  async function notificationsFor(userId: string, type: NotificationType) {
    return db
      .select()
      .from(notification)
      .where(and(eq(notification.userId, userId), eq(notification.type, type)))
  }

  it('sends the author a statement of reasons carrying the Article 17(3) elements', async () => {
    const { author, admin, review: r } = await seedReportedReview()

    await updateReviewModerationStatusQuery(r.id, 'hidden', {
      ground: 'terms',
      explanation: 'Names another customer.',
      actorUserId: admin.id,
    })

    const [sent] = await notificationsFor(author.id, 'review_moderated')
    expect(sent).toBeDefined()
    const data = sent.data as Record<string, unknown>
    // (a) what, where, how long — (b) the facts and whether a notice prompted it
    expect(data.restriction).toBe('hidden')
    expect(data.territorialScope).toBe('all')
    expect(data.duration).toBe('indefinite')
    expect(data.explanation).toBe('Names another customer.')
    expect(data.promptedByNotice).toBe(true)
    // (c) automated means, (d)/(e) the ground, (f) redress
    expect(data.automatedMeans).toBe(false)
    expect(data.ground).toBe('terms')
    expect(data.redress).toEqual(['contact_support', 'judicial_remedy'])
  })

  it('tells the reporter the outcome and resolves their notice', async () => {
    const { reporter, admin, review: r } = await seedReportedReview()

    await updateReviewModerationStatusQuery(r.id, 'hidden', {
      ground: 'illegal',
      explanation: 'Defamatory.',
      actorUserId: admin.id,
    })

    const [sent] = await notificationsFor(reporter.id, 'review_report_resolved')
    expect((sent.data as Record<string, unknown>).outcome).toBe('upheld')

    const [report] = await db.select().from(reviewReport).where(eq(reviewReport.reviewId, r.id))
    expect(report.status).toBe('upheld')
    expect(report.resolvedByUserId).toBe(admin.id)
    expect(report.resolvedAt).not.toBeNull()
  })

  it('dismisses the notice when the review is left up', async () => {
    const { author, reporter, admin, review: r } = await seedReportedReview()

    await updateReviewModerationStatusQuery(r.id, 'approved', {
      ground: 'terms',
      explanation: 'Checked; it stands.',
      actorUserId: admin.id,
    })

    const [report] = await db.select().from(reviewReport).where(eq(reviewReport.reviewId, r.id))
    expect(report.status).toBe('dismissed')

    const [sent] = await notificationsFor(reporter.id, 'review_report_resolved')
    expect((sent.data as Record<string, unknown>).outcome).toBe('dismissed')

    // Nothing changed for the author — the review was already approved — so
    // there is no restriction to state reasons for.
    expect(await notificationsFor(author.id, 'review_moderated')).toHaveLength(0)
  })

  it('does not restate reasons when the status is unchanged', async () => {
    const { author, admin, review: r } = await seedReportedReview()

    await updateReviewModerationStatusQuery(r.id, 'hidden', {
      ground: 'terms',
      explanation: 'First decision.',
      actorUserId: admin.id,
    })
    await updateReviewModerationStatusQuery(r.id, 'hidden', {
      ground: 'terms',
      explanation: 'Same again.',
      actorUserId: admin.id,
    })

    expect(await notificationsFor(author.id, 'review_moderated')).toHaveLength(1)
  })
})

describe('seller replies', () => {
  async function seedReplyableReview() {
    const seller = await seedUser({
      id: 'seller-1',
      email: 'seller-1@example.com',
      role: 'creator',
    })
    const buyer = await seedUser({ id: 'buyer-1', email: 'buyer-1@example.com' })
    const s = await seedShop({ ownerId: seller.id, status: 'active', isSuspended: false })
    const p = await seedProduct()
    const address = {
      name: 'Buyer',
      street: 'St',
      city: 'City',
      postalCode: '12345',
      country: 'DE',
    }
    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: buyer.id,
        shippingAddress: address,
        billingAddress: address,
        totalCents: 1000,
      })
      .returning()
    const [shopOrderRecord] = await db
      .insert(shopOrder)
      .values({
        platformOrderId: order.id,
        shopId: s.id,
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      })
      .returning()
    const [reviewRecord] = await db
      .insert(review)
      .values({
        shopOrderId: shopOrderRecord.id,
        productId: p.id,
        buyerUserId: buyer.id,
        rating: 4,
        comment: 'Lovely work',
      })
      .returning()
    return { seller, buyer, product: p, review: reviewRecord }
  }

  it('requires current shop ownership and permits exactly one trimmed reply', async () => {
    const { seller, buyer, review: reviewRecord } = await seedReplyableReview()
    await expect(createSellerReplyQuery(reviewRecord.id, buyer.id, 'Nope')).rejects.toMatchObject({
      status: 403,
    })
    const created = await createSellerReplyQuery(reviewRecord.id, seller.id, '  Thank you!  ')
    expect(created.body).toBe('Thank you!')
    await expect(updateSellerReplyQuery(created.id, buyer.id, 'Edited')).rejects.toMatchObject({
      status: 403,
    })
    expect((await updateSellerReplyQuery(created.id, seller.id, '  Edited reply  ')).body).toBe(
      'Edited reply',
    )
    await expect(
      createSellerReplyQuery(reviewRecord.id, seller.id, 'A second reply'),
    ).rejects.toMatchObject({
      status: 409,
    })
    expect(
      await db.select().from(sellerReply).where(eq(sellerReply.reviewId, reviewRecord.id)),
    ).toHaveLength(1)
    const [notificationRecord] = await db
      .select()
      .from(notification)
      .where(and(eq(notification.userId, buyer.id), eq(notification.type, 'seller_reply_received')))
    expect((notificationRecord.data as Record<string, unknown>).replyId).toBe(created.id)
  })

  it('records idempotent reports without changing seller-reply visibility', async () => {
    const { seller, review: reviewRecord } = await seedReplyableReview()
    const reporter = await seedUser({
      id: 'reply-reporter-1',
      email: 'reply-reporter-1@example.com',
    })
    const created = await createSellerReplyQuery(reviewRecord.id, seller.id, 'Thank you')
    expect(await reportSellerReplyQuery(created.id, reporter.id, 'spam', null)).toEqual({
      alreadyReported: false,
    })
    expect(await reportSellerReplyQuery(created.id, reporter.id, 'offensive', 'again')).toEqual({
      alreadyReported: true,
    })
    const [unchanged] = await db.select().from(sellerReply).where(eq(sellerReply.id, created.id))
    expect(unchanged.moderationStatus).toBe('approved')
    expect(await getSellerReplyReportsQuery([created.id])).toEqual(new Map([[created.id, 1]]))
  })

  it('projects only approved replies and resolves reports on moderation', async () => {
    const { seller, product: p, review: reviewRecord } = await seedReplyableReview()
    const reporter = await seedUser({
      id: 'reply-reporter-2',
      email: 'reply-reporter-2@example.com',
    })
    const admin = await seedUser({
      id: 'reply-admin-1',
      email: 'reply-admin-1@example.com',
      role: 'admin',
    })
    const created = await createSellerReplyQuery(
      reviewRecord.id,
      seller.id,
      'Thank you for your review',
    )
    const publicReviews = await getProductReviewsQuery(p.id, 1, 10)
    expect(publicReviews.reviews[0].sellerReply).toMatchObject({
      id: created.id,
      sellerName: 'Test Shop',
    })
    expect(publicReviews.reviews[0].sellerReply?.sellerName).not.toBe(seller.name)

    await reportSellerReplyQuery(created.id, reporter.id, 'personal_data', 'Names a buyer')
    await updateSellerReplyModerationStatusQuery(created.id, 'hidden', {
      ground: 'terms',
      legalBasis: 'Community guidelines',
      explanation: 'Contains personal information.',
      actorUserId: admin.id,
    })
    expect((await getProductReviewsQuery(p.id, 1, 10)).reviews[0].sellerReply).toBeNull()

    const [report] = await db
      .select()
      .from(sellerReplyReport)
      .where(eq(sellerReplyReport.sellerReplyId, created.id))
    expect(report).toMatchObject({ status: 'upheld', resolvedByUserId: admin.id })
    expect((await getAdminSellerRepliesQuery('hidden', 1, 10)).sellerReplies[0]).toMatchObject({
      id: created.id,
      openReports: 0,
    })
    const [authorNotice] = await db
      .select()
      .from(notification)
      .where(
        and(eq(notification.userId, seller.id), eq(notification.type, 'seller_reply_moderated')),
      )
    expect((authorNotice.data as Record<string, unknown>).legalBasis).toBe('Community guidelines')
    const [reporterNotice] = await db
      .select()
      .from(notification)
      .where(
        and(
          eq(notification.userId, reporter.id),
          eq(notification.type, 'seller_reply_report_resolved'),
        ),
      )
    expect((reporterNotice.data as Record<string, unknown>).outcome).toBe('upheld')
  })
})
