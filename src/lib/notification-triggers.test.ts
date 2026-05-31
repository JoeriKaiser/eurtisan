import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import {
  cart,
  cartItem,
  dispute,
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
import { brevoEmailProvider } from '#/integrations/email'

vi.mock('#/integrations/email', async (importOriginal) => {
  const mod = await importOriginal<typeof import('#/integrations/email')>()
  return {
    ...mod,
    createEmailProvider: () => brevoEmailProvider,
  }
})

import { createCheckoutQuery } from './checkout.server'
import { openDisputeQuery, resolveDisputeQuery } from './disputes.server'
import { getNotificationsQuery } from './notifications.server'
import { markPayoutSentQuery } from './payouts.server'
import { createReviewQuery } from './reviews.server'
import { flushBackgroundWorkForTests } from './background-work.server'
import { markShopOrderShippedQuery, updateShopOrderStatusQuery } from './shop-orders.server'

beforeEach(async () => {
  await db.delete(notification)
  await db.delete(dispute)
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
  vi.restoreAllMocks()
})

afterAll(async () => {
  await db.delete(notification)
  await db.delete(dispute)
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


async function seedShop(overrides?: Partial<typeof shop.$inferInsert>) {
  return db
    .insert(shop)
    .values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      status: 'active',
      ownerId: 'seller-1',
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
      status: 'active',
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
        shippingSelections: [{ shopId: 'shop-1', method: 'standard', costCents: 538 }],
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

    await flushBackgroundWorkForTests()
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
      status: 'active',
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
        shippingSelections: [{ shopId: 'shop-1', method: 'standard', costCents: 538 }],
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

    await flushBackgroundWorkForTests()
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
      status: 'active',
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

    await flushBackgroundWorkForTests()
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
      status: 'active',
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

    await flushBackgroundWorkForTests()
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
      status: 'active',
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

    await flushBackgroundWorkForTests()
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
      status: 'active',
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

    await flushBackgroundWorkForTests()
    const buyerNotifications = await getNotificationsQuery(buyer.id, 1, 10)
    expect(buyerNotifications.notifications).toHaveLength(1)
    expect(buyerNotifications.notifications[0].type).toBe('dispute_opened')
    expect(buyerNotifications.notifications[0].data).toMatchObject({
      platformOrderId: order.id,
      shopOrderId: so.id,
    })
  })
})

/* -------------------------------------------------------------------------- */
/*                            Email Notification Tests                        */
/* -------------------------------------------------------------------------- */

describe('createCheckoutQuery emails', () => {
  it('sends order_confirmation email to buyer', async () => {
    const sendSpy = vi.spyOn(brevoEmailProvider, 'sendTransactional').mockResolvedValue({
      messageId: 'msg-test',
      accepted: true,
    })

    const buyer = await seedUser({ id: 'buyer-1', email: 'buyer@example.com' })
    const seller = await seedUser({ id: 'seller-1', email: 'seller@example.com' })
    await db.insert(shop).values({
      id: 'shop-1',
      status: 'active',
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

    await createCheckoutQuery(
      {
        cartId: c.id,
        shippingSelections: [{ shopId: 'shop-1', method: 'standard', costCents: 538 }],
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

    await flushBackgroundWorkForTests()
    const buyerEmailCall = sendSpy.mock.calls.find((call) => call[0] === 'buyer@example.com')
    expect(buyerEmailCall).toBeDefined()
    expect(buyerEmailCall?.[1]).toBe('order_confirmation')
  })

  it('sends order_confirmation email to seller', async () => {
    const sendSpy = vi.spyOn(brevoEmailProvider, 'sendTransactional').mockResolvedValue({
      messageId: 'msg-test',
      accepted: true,
    })

    const buyer = await seedUser({ id: 'buyer-1', email: 'buyer@example.com' })
    const seller = await seedUser({ id: 'seller-1', email: 'seller@example.com' })
    await db.insert(shop).values({
      id: 'shop-1',
      status: 'active',
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

    await createCheckoutQuery(
      {
        cartId: c.id,
        shippingSelections: [{ shopId: 'shop-1', method: 'standard', costCents: 538 }],
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

    await flushBackgroundWorkForTests()
    const sellerEmailCall = sendSpy.mock.calls.find((call) => call[0] === 'seller@example.com')
    expect(sellerEmailCall).toBeDefined()
    expect(sellerEmailCall?.[1]).toBe('order_confirmation')
  })

  it('does not break checkout when email send fails', async () => {
    vi.spyOn(brevoEmailProvider, 'sendTransactional').mockRejectedValue(
      new Error('Simulated email failure'),
    )
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const buyer = await seedUser({ id: 'buyer-1', email: 'buyer@example.com' })
    const seller = await seedUser({ id: 'seller-1', email: 'seller@example.com' })
    await db.insert(shop).values({
      id: 'shop-1',
      status: 'active',
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
        shippingSelections: [{ shopId: 'shop-1', method: 'standard', costCents: 538 }],
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

    expect(result.platformOrderId).toBeDefined()
    expect(result.checkoutUrl).toBeDefined()
    consoleSpy.mockRestore()
  })
})

describe('markShopOrderShippedQuery emails', () => {
  it('sends shipping_notification email to buyer', async () => {
    const sendSpy = vi.spyOn(brevoEmailProvider, 'sendTransactional').mockResolvedValue({
      messageId: 'msg-test',
      accepted: true,
    })

    const buyer = await seedUser({ id: 'buyer-1', email: 'buyer@example.com' })
    const seller = await seedUser({ id: 'seller-1', email: 'seller@example.com' })
    await db.insert(shop).values({
      id: 'shop-1',
      status: 'active',
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

    await markShopOrderShippedQuery(so.id, { trackingNumber: 'TRACK-123' })

    await flushBackgroundWorkForTests()
    const buyerEmailCall = sendSpy.mock.calls.find((call) => call[0] === 'buyer@example.com')
    expect(buyerEmailCall).toBeDefined()
    expect(buyerEmailCall?.[1]).toBe('shipping_notification')
    expect(buyerEmailCall?.[2]).toMatchObject({
      trackingNumber: 'TRACK-123',
      carrier: 'Mondial Relay',
    })
  })

  it('does not break markShopOrderShippedQuery when email send fails', async () => {
    vi.spyOn(brevoEmailProvider, 'sendTransactional').mockRejectedValue(
      new Error('Simulated email failure'),
    )
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const buyer = await seedUser({ id: 'buyer-1', email: 'buyer@example.com' })
    const seller = await seedUser({ id: 'seller-1', email: 'seller@example.com' })
    await db.insert(shop).values({
      id: 'shop-1',
      status: 'active',
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

    const result = await markShopOrderShippedQuery(so.id, { trackingNumber: 'TRACK-123' })

    expect(result.status).toBe('shipped')
    expect(result.trackingNumber).toBe('TRACK-123')
    consoleSpy.mockRestore()
  })
})

describe('dispute email notifications', () => {
  it('sends dispute_update email when dispute is opened via openDisputeQuery', async () => {
    const sendSpy = vi.spyOn(brevoEmailProvider, 'sendTransactional').mockResolvedValue({
      messageId: 'msg-test',
      accepted: true,
    })

    const buyer = await seedUser({ id: 'buyer-1', email: 'buyer@example.com' })
    const seller = await seedUser({ id: 'seller-1', email: 'seller@example.com' })
    await db.insert(shop).values({
      id: 'shop-1',
      status: 'active',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: seller.id,
    })

    const [po] = await db
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
        platformOrderId: po.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      })
      .returning()

    const disputeResult = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Damaged', description: 'Box crushed' },
      buyer.id,
    )

    await flushBackgroundWorkForTests()
    const buyerEmailCall = sendSpy.mock.calls.find((call) => call[0] === 'buyer@example.com')
    expect(buyerEmailCall).toBeDefined()
    expect(buyerEmailCall?.[1]).toBe('dispute_update')
    expect(buyerEmailCall?.[2]).toMatchObject({
      status: 'opened',
      message: 'Damaged',
    })
    expect(buyerEmailCall?.[2].disputeUrl).toContain(`/disputes/${disputeResult.id}`)
  })

  it('sends dispute_update email when dispute is opened via updateShopOrderStatusQuery', async () => {
    const sendSpy = vi.spyOn(brevoEmailProvider, 'sendTransactional').mockResolvedValue({
      messageId: 'msg-test',
      accepted: true,
    })

    const buyer = await seedUser({ id: 'buyer-1', email: 'buyer@example.com' })
    const seller = await seedUser({ id: 'seller-1', email: 'seller@example.com' })
    await db.insert(shop).values({
      id: 'shop-1',
      status: 'active',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: seller.id,
    })

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

    await flushBackgroundWorkForTests()
    const buyerEmailCall = sendSpy.mock.calls.find((call) => call[0] === 'buyer@example.com')
    expect(buyerEmailCall).toBeDefined()
    expect(buyerEmailCall?.[1]).toBe('dispute_update')
    expect(buyerEmailCall?.[2]).toMatchObject({
      status: 'opened',
    })
  })

  it('sends dispute_update emails to buyer and seller on resolve', async () => {
    const sendSpy = vi.spyOn(brevoEmailProvider, 'sendTransactional').mockResolvedValue({
      messageId: 'msg-test',
      accepted: true,
    })

    const buyer = await seedUser({ id: 'buyer-1', email: 'buyer@example.com' })
    const seller = await seedUser({ id: 'seller-1', email: 'seller@example.com' })
    await db.insert(shop).values({
      id: 'shop-1',
      status: 'active',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: seller.id,
    })

    const [po] = await db
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
        platformOrderId: po.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      })
      .returning()

    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      buyer.id,
    )

    sendSpy.mockClear()

    await resolveDisputeQuery(d.id, { resolution: 'close' }, { userId: 'admin-1', role: 'admin' })

    await flushBackgroundWorkForTests()
    const buyerEmailCall = sendSpy.mock.calls.find((call) => call[0] === 'buyer@example.com')
    await flushBackgroundWorkForTests()
    const sellerEmailCall = sendSpy.mock.calls.find((call) => call[0] === 'seller@example.com')

    expect(buyerEmailCall).toBeDefined()
    expect(buyerEmailCall?.[1]).toBe('dispute_update')
    expect(sellerEmailCall).toBeDefined()
    expect(sellerEmailCall?.[1]).toBe('dispute_update')
  })

  it('does not break dispute resolution when email send fails', async () => {
    vi.spyOn(brevoEmailProvider, 'sendTransactional').mockRejectedValue(
      new Error('Simulated email failure'),
    )
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const buyer = await seedUser({ id: 'buyer-1', email: 'buyer@example.com' })
    const seller = await seedUser({ id: 'seller-1', email: 'seller@example.com' })
    await db.insert(shop).values({
      id: 'shop-1',
      status: 'active',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: seller.id,
    })

    const [po] = await db
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
        platformOrderId: po.id,
        shopId: 'shop-1',
        shippingMethod: 'standard',
        shippingCostCents: 500,
        subtotalCents: 1000,
        status: 'delivered',
        deliveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      })
      .returning()

    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      buyer.id,
    )

    const result = await resolveDisputeQuery(
      d.id,
      { resolution: 'close' },
      { userId: 'admin-1', role: 'admin' },
    )

    expect(result.status).toBe('resolved')
    expect(result.resolution).toBe('close')
    consoleSpy.mockRestore()
  })
})

describe('markPayoutSentQuery notification', () => {
  it('creates payout_sent notification for seller', async () => {
    const seller = await seedUser({ id: 'seller-1', email: 'seller@example.com' })
    await db.insert(shop).values({
      id: 'shop-1',
      status: 'active',
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

    await flushBackgroundWorkForTests()
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
      status: 'active',
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

    await flushBackgroundWorkForTests()
    const sellerNotifications = await getNotificationsQuery(seller.id, 1, 10)
    expect(sellerNotifications.notifications).toHaveLength(0)
  })
})
