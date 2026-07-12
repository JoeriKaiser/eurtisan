import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { brevoEmailProvider } from '#/integrations/email'

vi.mock('#/integrations/email', async (importOriginal) => {
  const mod = await importOriginal<typeof import('#/integrations/email')>()
  return {
    ...mod,
    createEmailProvider: () => brevoEmailProvider,
  }
})

import { clearTestTables } from '#/test/cleanup'
import {
  createCart,
  createCartItem,
  createOrderItem,
  createPayout,
  createPlatformOrder,
  createProduct,
  createShop,
  createShopOrder,
  createUser,
} from '#/test/factories'

import { flushBackgroundWorkForTests } from '../background-work.server'
import { flushEmailOutboxForTests } from '../email-outbox.server'
import { createCheckoutQuery } from '../checkout.server'

async function flushAll(): Promise<void> {
  await flushBackgroundWorkForTests()
  await flushEmailOutboxForTests()
}
import { openDisputeQuery, resolveDisputeQuery } from '../disputes.server'
import { getNotificationsQuery } from '../notifications.server'
import { markPayoutSentQuery } from '../payouts.server'
import { createReviewQuery } from '../reviews.server'
import { markShopOrderShippedQuery, updateShopOrderStatusQuery } from '../shop-orders.server'

beforeEach(async () => {
  await clearTestTables()
  vi.restoreAllMocks()
})

afterAll(async () => {
  await clearTestTables()
})

describe('createCheckoutQuery notifications', () => {
  it('creates order_placed notification for buyer', async () => {
    const buyer = await createUser({ email: 'buyer@example.com' })
    const seller = await createUser({ email: 'seller@example.com' })
    const shop = await createShop(seller, { name: 'Test Shop', slug: 'test-shop' })
    const product = await createProduct(shop, { name: 'Vase', slug: 'vase' })

    const cart = await createCart(buyer)
    await createCartItem(cart, product, { quantity: 1 })

    const result = await createCheckoutQuery(
      {
        cartId: cart.id,
        shippingSelections: [{ shopId: shop.id, method: 'express', costCents: 861 }],
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

    await flushAll()
    const buyerNotifications = await getNotificationsQuery(buyer.id, 1, 10)
    expect(buyerNotifications.notifications).toHaveLength(1)
    expect(buyerNotifications.notifications[0].type).toBe('order_placed')
    expect(buyerNotifications.notifications[0].data).toMatchObject({
      platformOrderId: result.platformOrderId,
    })
  })

  it('creates order_placed notification for seller', async () => {
    const buyer = await createUser({ email: 'buyer@example.com' })
    const seller = await createUser({ email: 'seller@example.com' })
    const shop = await createShop(seller, { name: 'Test Shop', slug: 'test-shop' })
    const product = await createProduct(shop, { name: 'Vase', slug: 'vase' })

    const cart = await createCart(buyer)
    await createCartItem(cart, product, { quantity: 1 })

    const result = await createCheckoutQuery(
      {
        cartId: cart.id,
        shippingSelections: [{ shopId: shop.id, method: 'express', costCents: 861 }],
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

    await flushAll()
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
    const buyer = await createUser({ email: 'buyer@example.com' })
    const seller = await createUser({ email: 'seller@example.com' })
    const shop = await createShop(seller, { name: 'Test Shop', slug: 'test-shop' })
    await createProduct(shop, { name: 'Vase', slug: 'vase' })

    const order = await createPlatformOrder(buyer, { totalCents: 1000, status: 'paid' })
    const so = await createShopOrder(order, shop, {
      subtotalCents: 1000,
      shippingCostCents: 500,
      status: 'paid',
    })

    await markShopOrderShippedQuery(so.id, {})

    await flushAll()
    const buyerNotifications = await getNotificationsQuery(buyer.id, 1, 10)
    expect(buyerNotifications.notifications).toHaveLength(1)
    expect(buyerNotifications.notifications[0].type).toBe('order_shipped')
    expect(buyerNotifications.notifications[0].data).toMatchObject({
      platformOrderId: order.id,
      shopOrderId: so.id,
    })
  })

  it('does not create duplicate order_shipped notification on idempotent tracking update', async () => {
    const buyer = await createUser({ email: 'buyer@example.com' })
    const seller = await createUser({ email: 'seller@example.com' })
    const shop = await createShop(seller, { name: 'Test Shop', slug: 'test-shop' })
    await createProduct(shop, { name: 'Vase', slug: 'vase' })

    const order = await createPlatformOrder(buyer, { totalCents: 1000, status: 'paid' })
    const so = await createShopOrder(order, shop, {
      subtotalCents: 1000,
      shippingCostCents: 500,
      status: 'paid',
    })

    // First shipment creates the notification
    await markShopOrderShippedQuery(so.id, { trackingNumber: 'TRACK-123' })

    // Idempotent tracking update should not create another notification
    await markShopOrderShippedQuery(so.id, { trackingNumber: 'TRACK-456' })

    await flushAll()
    const buyerNotifications = await getNotificationsQuery(buyer.id, 1, 10)
    expect(buyerNotifications.notifications).toHaveLength(1)
  })
})

describe('createReviewQuery notification', () => {
  it('creates review_received notification for seller', async () => {
    const buyer = await createUser({ email: 'buyer@example.com' })
    const seller = await createUser({ email: 'seller@example.com' })
    const shop = await createShop(seller, { name: 'Test Shop', slug: 'test-shop' })
    const product = await createProduct(shop, { name: 'Vase', slug: 'vase' })

    const order = await createPlatformOrder(buyer, { totalCents: 1000 })
    const so = await createShopOrder(order, shop, {
      subtotalCents: 1000,
      shippingCostCents: 500,
      status: 'delivered',
      deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    })

    await createOrderItem(so, product, { quantity: 1 })

    const result = await createReviewQuery(so.id, product.id, buyer.id, 5, 'Great!')

    await flushAll()
    const sellerNotifications = await getNotificationsQuery(seller.id, 1, 10)
    expect(sellerNotifications.notifications).toHaveLength(1)
    expect(sellerNotifications.notifications[0].type).toBe('review_received')
    expect(sellerNotifications.notifications[0].data).toMatchObject({
      shopOrderId: so.id,
      productId: product.id,
      reviewId: result.id,
      productName: 'Vase',
    })
  })
})

describe('updateShopOrderStatusQuery dispute notification', () => {
  it('creates dispute_opened notification for buyer', async () => {
    const buyer = await createUser({ email: 'buyer@example.com' })
    const seller = await createUser({ email: 'seller@example.com' })
    const shop = await createShop(seller, { name: 'Test Shop', slug: 'test-shop' })
    await createProduct(shop, { name: 'Vase', slug: 'vase' })

    const order = await createPlatformOrder(buyer, { totalCents: 1000, status: 'shipped' })
    const so = await createShopOrder(order, shop, {
      subtotalCents: 1000,
      shippingCostCents: 500,
      status: 'shipped',
    })

    await updateShopOrderStatusQuery(so.id, { status: 'disputed' })

    await flushAll()
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
      provider: 'brevo',
    })

    const buyer = await createUser({ email: 'buyer@example.com' })
    const seller = await createUser({ email: 'seller@example.com' })
    const shop = await createShop(seller, { name: 'Test Shop', slug: 'test-shop' })
    const product = await createProduct(shop, { name: 'Vase', slug: 'vase' })

    const cart = await createCart(buyer)
    await createCartItem(cart, product, { quantity: 1 })

    await createCheckoutQuery(
      {
        cartId: cart.id,
        shippingSelections: [{ shopId: shop.id, method: 'express', costCents: 861 }],
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

    await flushAll()
    const buyerEmailCall = sendSpy.mock.calls.find((call) => call[0] === 'buyer@example.com')
    expect(buyerEmailCall).toBeDefined()
    expect(buyerEmailCall?.[1]).toBe('order_confirmation')
  })

  it('sends order_confirmation email to seller', async () => {
    const sendSpy = vi.spyOn(brevoEmailProvider, 'sendTransactional').mockResolvedValue({
      messageId: 'msg-test',
      accepted: true,
      provider: 'brevo',
    })

    const buyer = await createUser({ email: 'buyer@example.com' })
    const seller = await createUser({ email: 'seller@example.com' })
    const shop = await createShop(seller, { name: 'Test Shop', slug: 'test-shop' })
    const product = await createProduct(shop, { name: 'Vase', slug: 'vase' })

    const cart = await createCart(buyer)
    await createCartItem(cart, product, { quantity: 1 })

    await createCheckoutQuery(
      {
        cartId: cart.id,
        shippingSelections: [{ shopId: shop.id, method: 'express', costCents: 861 }],
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

    await flushAll()
    const sellerEmailCall = sendSpy.mock.calls.find((call) => call[0] === 'seller@example.com')
    expect(sellerEmailCall).toBeDefined()
    expect(sellerEmailCall?.[1]).toBe('order_confirmation')
  })

  it('does not break checkout when email send fails', async () => {
    vi.spyOn(brevoEmailProvider, 'sendTransactional').mockRejectedValue(
      new Error('Simulated email failure'),
    )
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const buyer = await createUser({ email: 'buyer@example.com' })
    const seller = await createUser({ email: 'seller@example.com' })
    const shop = await createShop(seller, { name: 'Test Shop', slug: 'test-shop' })
    const product = await createProduct(shop, { name: 'Vase', slug: 'vase' })

    const cart = await createCart(buyer)
    await createCartItem(cart, product, { quantity: 1 })

    const result = await createCheckoutQuery(
      {
        cartId: cart.id,
        shippingSelections: [{ shopId: shop.id, method: 'express', costCents: 861 }],
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
      provider: 'brevo',
    })

    const buyer = await createUser({ email: 'buyer@example.com' })
    const seller = await createUser({ email: 'seller@example.com' })
    const shop = await createShop(seller, { name: 'Test Shop', slug: 'test-shop' })
    await createProduct(shop, { name: 'Vase', slug: 'vase' })

    const order = await createPlatformOrder(buyer, { totalCents: 1000, status: 'paid' })
    const so = await createShopOrder(order, shop, {
      subtotalCents: 1000,
      shippingCostCents: 500,
      status: 'paid',
    })

    await markShopOrderShippedQuery(so.id, { trackingNumber: 'TRACK-123' })

    await flushAll()
    const buyerEmailCall = sendSpy.mock.calls.find((call) => call[0] === 'buyer@example.com')
    expect(buyerEmailCall).toBeDefined()
    expect(buyerEmailCall?.[1]).toBe('shipping_notification')
    expect(buyerEmailCall?.[2]).toMatchObject({
      trackingNumber: 'TRACK-123',
      carrier: 'Sendcloud',
    })
  })

  it('does not break markShopOrderShippedQuery when email send fails', async () => {
    vi.spyOn(brevoEmailProvider, 'sendTransactional').mockRejectedValue(
      new Error('Simulated email failure'),
    )
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const buyer = await createUser({ email: 'buyer@example.com' })
    const seller = await createUser({ email: 'seller@example.com' })
    const shop = await createShop(seller, { name: 'Test Shop', slug: 'test-shop' })
    await createProduct(shop, { name: 'Vase', slug: 'vase' })

    const order = await createPlatformOrder(buyer, { totalCents: 1000, status: 'paid' })
    const so = await createShopOrder(order, shop, {
      subtotalCents: 1000,
      shippingCostCents: 500,
      status: 'paid',
    })

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
      provider: 'brevo',
    })

    const buyer = await createUser({ email: 'buyer@example.com' })
    const seller = await createUser({ email: 'seller@example.com' })
    const shop = await createShop(seller, { name: 'Test Shop', slug: 'test-shop' })

    const po = await createPlatformOrder(buyer, { totalCents: 1000 })
    const so = await createShopOrder(po, shop, {
      subtotalCents: 1000,
      shippingCostCents: 500,
      status: 'delivered',
      deliveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    })

    const disputeResult = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Damaged', description: 'Box crushed' },
      buyer.id,
    )

    await flushAll()
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
      provider: 'brevo',
    })

    const buyer = await createUser({ email: 'buyer@example.com' })
    const seller = await createUser({ email: 'seller@example.com' })
    const shop = await createShop(seller, { name: 'Test Shop', slug: 'test-shop' })

    const order = await createPlatformOrder(buyer, { totalCents: 1000, status: 'shipped' })
    const so = await createShopOrder(order, shop, {
      subtotalCents: 1000,
      shippingCostCents: 500,
      status: 'shipped',
    })

    await updateShopOrderStatusQuery(so.id, { status: 'disputed' })

    await flushAll()
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
      provider: 'brevo',
    })

    const buyer = await createUser({ email: 'buyer@example.com' })
    const seller = await createUser({ email: 'seller@example.com' })
    const shop = await createShop(seller, { name: 'Test Shop', slug: 'test-shop' })

    const po = await createPlatformOrder(buyer, { totalCents: 1000 })
    const so = await createShopOrder(po, shop, {
      subtotalCents: 1000,
      shippingCostCents: 500,
      status: 'delivered',
      deliveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    })

    const d = await openDisputeQuery(
      { shopOrderId: so.id, reason: 'Issue', description: 'Problem' },
      buyer.id,
    )

    sendSpy.mockClear()

    await resolveDisputeQuery(d.id, { resolution: 'close' }, { userId: 'admin-1', role: 'admin' })

    await flushAll()
    const buyerEmailCall = sendSpy.mock.calls.find((call) => call[0] === 'buyer@example.com')
    await flushAll()
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

    const buyer = await createUser({ email: 'buyer@example.com' })
    const seller = await createUser({ email: 'seller@example.com' })
    const shop = await createShop(seller, { name: 'Test Shop', slug: 'test-shop' })

    const po = await createPlatformOrder(buyer, { totalCents: 1000 })
    const so = await createShopOrder(po, shop, {
      subtotalCents: 1000,
      shippingCostCents: 500,
      status: 'delivered',
      deliveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    })

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
    const seller = await createUser({ email: 'seller@example.com' })
    const shop = await createShop(seller, {
      name: 'Test Shop',
      slug: 'test-shop',
      mollieAccountId: 'org_mock_1',
      paymentConnected: true,
    })

    const order = await createPlatformOrder(seller, {
      totalCents: 5000,
      status: 'paid',
      molliePaymentId: 'tr_mock_payout_1',
    })
    const so = await createShopOrder(order, shop, {
      subtotalCents: 5000,
      shippingCostCents: 0,
      vatAmountCents: 0,
      status: 'delivered',
    })

    const p = await createPayout(shop, {
      shopOrderId: so.id,
      amountCents: 5000,
      status: 'pending',
    })

    await markPayoutSentQuery(p.id)

    await flushAll()
    const sellerNotifications = await getNotificationsQuery(seller.id, 1, 10)
    expect(sellerNotifications.notifications).toHaveLength(1)
    expect(sellerNotifications.notifications[0].type).toBe('payout_sent')
    expect(sellerNotifications.notifications[0].data).toMatchObject({
      payoutId: p.id,
      shopId: shop.id,
      amount: '50',
    })
  })

  it('is idempotent when payout is already sent', async () => {
    const seller = await createUser({ email: 'seller@example.com' })
    const shop = await createShop(seller, {
      name: 'Test Shop',
      slug: 'test-shop',
      mollieAccountId: 'org_mock_1',
      paymentConnected: true,
    })

    const order = await createPlatformOrder(seller, {
      totalCents: 5000,
      status: 'paid',
      molliePaymentId: 'tr_mock_payout_1',
    })
    const so = await createShopOrder(order, shop, {
      subtotalCents: 5000,
      shippingCostCents: 0,
      vatAmountCents: 0,
      status: 'delivered',
    })

    const p = await createPayout(shop, {
      shopOrderId: so.id,
      amountCents: 5000,
      status: 'sent',
      sentAt: new Date(),
    })

    await markPayoutSentQuery(p.id)

    await flushAll()
    const sellerNotifications = await getNotificationsQuery(seller.id, 1, 10)
    expect(sellerNotifications.notifications).toHaveLength(0)
  })
})
