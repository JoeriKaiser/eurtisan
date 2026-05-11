import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import {
  cart,
  cartItem,
  notification,
  orderItem,
  payout,
  platformOrder,
  product,
  review,
  shop,
  shopOrder,
  user,
} from '#/db/schema'

import { createCheckoutQuery } from './checkout.server'
import { getNotificationsQuery } from './notifications.server'
import { markPayoutSentQuery } from './payouts.server'
import { createReviewQuery } from './reviews.server'
import { markShopOrderShippedQuery, updateShopOrderStatusQuery } from './shop-orders.server'

beforeEach(async () => {
  await db.delete(notification)
  await db.delete(review)
  await db.delete(payout)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(cartItem)
  await db.delete(cart)
  await db.delete(product)
  await db.delete(shop)
  await db.delete(user)
})

afterAll(async () => {
  await db.delete(notification)
  await db.delete(review)
  await db.delete(payout)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(cartItem)
  await db.delete(cart)
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

describe('createCheckoutQuery notifications', () => {
  it('creates order_placed notification for buyer', async () => {
    const buyer = await seedUser({ id: 'buyer-1', email: 'buyer@example.com' })
    const seller = await seedUser({ id: 'seller-1', email: 'seller@example.com' })
    await db.insert(shop).values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: seller.id,
    })
    await seedProduct()

    const [c] = await db
      .insert(cart)
      .values({ userId: buyer.id, expiresAt: new Date(Date.now() + 3600_000) })
      .returning()

    await db.insert(cartItem).values({
      cartId: c.id,
      productId: 'prod-1',
      quantity: 1,
    })

    const result = await createCheckoutQuery(
      {
        cartId: c.id,
        shippingSelections: [{ shopId: 'shop-1', method: 'standard' }],
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
      },
      buyer.id,
    )

    const buyerNotifications = await getNotificationsQuery(buyer.id, 1, 10)
    expect(buyerNotifications.notifications).toHaveLength(1)
    expect(buyerNotifications.notifications[0].type).toBe('order_placed')
    expect(buyerNotifications.notifications[0].data).toMatchObject({
      platformOrderId: result.platformOrderId,
    })
  })

  it('creates order_placed notification for seller', async () => {
    const buyer = await seedUser({ id: 'buyer-1', email: 'buyer@example.com' })
    const seller = await seedUser({ id: 'seller-1', email: 'seller@example.com' })
    await db.insert(shop).values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: seller.id,
    })
    await seedProduct()

    const [c] = await db
      .insert(cart)
      .values({ userId: buyer.id, expiresAt: new Date(Date.now() + 3600_000) })
      .returning()

    await db.insert(cartItem).values({
      cartId: c.id,
      productId: 'prod-1',
      quantity: 1,
    })

    const result = await createCheckoutQuery(
      {
        cartId: c.id,
        shippingSelections: [{ shopId: 'shop-1', method: 'standard' }],
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
      },
      buyer.id,
    )

    const sellerNotifications = await getNotificationsQuery(seller.id, 1, 10)
    expect(sellerNotifications.notifications).toHaveLength(1)
    expect(sellerNotifications.notifications[0].type).toBe('order_placed')
    expect(sellerNotifications.notifications[0].data).toMatchObject({
      platformOrderId: result.platformOrderId,
    })
    expect(sellerNotifications.notifications[0].data.shopOrderId).toBeDefined()
  })
})

describe('markShopOrderShippedQuery notification', () => {
  it('creates order_shipped notification for buyer', async () => {
    const buyer = await seedUser({ id: 'buyer-1', email: 'buyer@example.com' })
    const seller = await seedUser({ id: 'seller-1', email: 'seller@example.com' })
    await db.insert(shop).values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: seller.id,
    })
    await seedProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: buyer.id,
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
        subtotalCents: 1000,
        status: 'paid',
      })
      .returning()

    await markShopOrderShippedQuery(so.id, {})

    const buyerNotifications = await getNotificationsQuery(buyer.id, 1, 10)
    expect(buyerNotifications.notifications).toHaveLength(1)
    expect(buyerNotifications.notifications[0].type).toBe('order_shipped')
    expect(buyerNotifications.notifications[0].data).toMatchObject({
      platformOrderId: order.id,
      shopOrderId: so.id,
    })
  })

  it('does not create duplicate order_shipped notification on idempotent tracking update', async () => {
    const buyer = await seedUser({ id: 'buyer-1', email: 'buyer@example.com' })
    const seller = await seedUser({ id: 'seller-1', email: 'seller@example.com' })
    await db.insert(shop).values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: seller.id,
    })
    await seedProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: buyer.id,
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
        subtotalCents: 1000,
        status: 'paid',
      })
      .returning()

    // First shipment creates the notification
    await markShopOrderShippedQuery(so.id, { trackingNumber: 'TRACK-123' })

    // Idempotent tracking update should not create another notification
    await markShopOrderShippedQuery(so.id, { trackingNumber: 'TRACK-456' })

    const buyerNotifications = await getNotificationsQuery(buyer.id, 1, 10)
    expect(buyerNotifications.notifications).toHaveLength(1)
  })
})

describe('createReviewQuery notification', () => {
  it('creates review_received notification for seller', async () => {
    const buyer = await seedUser({ id: 'buyer-1', email: 'buyer@example.com' })
    const seller = await seedUser({ id: 'seller-1', email: 'seller@example.com' })
    await db.insert(shop).values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: seller.id,
    })
    await seedProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: buyer.id,
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

    await db.insert(orderItem).values({
      shopOrderId: so.id,
      productId: 'prod-1',
      productName: 'Vase',
      unitPriceCents: 1000,
      quantity: 1,
      totalCents: 1000,
    })

    const result = await createReviewQuery(so.id, 'prod-1', buyer.id, 5, 'Great!')

    const sellerNotifications = await getNotificationsQuery(seller.id, 1, 10)
    expect(sellerNotifications.notifications).toHaveLength(1)
    expect(sellerNotifications.notifications[0].type).toBe('review_received')
    expect(sellerNotifications.notifications[0].data).toMatchObject({
      shopOrderId: so.id,
      productId: 'prod-1',
      reviewId: result.id,
      productName: 'Vase',
    })
  })
})

describe('updateShopOrderStatusQuery dispute notification', () => {
  it('creates dispute_opened notification for buyer', async () => {
    const buyer = await seedUser({ id: 'buyer-1', email: 'buyer@example.com' })
    const seller = await seedUser({ id: 'seller-1', email: 'seller@example.com' })
    await db.insert(shop).values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: seller.id,
    })
    await seedProduct()

    const [order] = await db
      .insert(platformOrder)
      .values({
        userId: buyer.id,
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
        status: 'shipped',
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

    await updateShopOrderStatusQuery(so.id, { status: 'disputed' })

    const buyerNotifications = await getNotificationsQuery(buyer.id, 1, 10)
    expect(buyerNotifications.notifications).toHaveLength(1)
    expect(buyerNotifications.notifications[0].type).toBe('dispute_opened')
    expect(buyerNotifications.notifications[0].data).toMatchObject({
      platformOrderId: order.id,
      shopOrderId: so.id,
    })
  })
})

describe('markPayoutSentQuery notification', () => {
  it('creates payout_sent notification for seller', async () => {
    const seller = await seedUser({ id: 'seller-1', email: 'seller@example.com' })
    await db.insert(shop).values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: seller.id,
    })

    const [p] = await db
      .insert(payout)
      .values({
        shopId: 'shop-1',
        amountCents: 5000,
        status: 'pending',
      })
      .returning()

    await markPayoutSentQuery(p.id)

    const sellerNotifications = await getNotificationsQuery(seller.id, 1, 10)
    expect(sellerNotifications.notifications).toHaveLength(1)
    expect(sellerNotifications.notifications[0].type).toBe('payout_sent')
    expect(sellerNotifications.notifications[0].data).toMatchObject({
      payoutId: p.id,
      shopId: 'shop-1',
      amount: '50',
    })
  })

  it('is idempotent when payout is already sent', async () => {
    const seller = await seedUser({ id: 'seller-1', email: 'seller@example.com' })
    await db.insert(shop).values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: seller.id,
    })

    const [p] = await db
      .insert(payout)
      .values({
        shopId: 'shop-1',
        amountCents: 5000,
        status: 'sent',
        sentAt: new Date(),
      })
      .returning()

    await markPayoutSentQuery(p.id)

    const sellerNotifications = await getNotificationsQuery(seller.id, 1, 10)
    expect(sellerNotifications.notifications).toHaveLength(0)
  })
})
