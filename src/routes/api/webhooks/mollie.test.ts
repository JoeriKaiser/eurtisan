import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import {
  cart,
  cartItem,
  inventoryReservation,
  orderItem,
  platformOrder,
  product,
  shop,
  shopOrder,
  user,
} from '#/db/schema'
import { cancelOrderQuery } from '#/lib/orders.server'
import type { PaymentProvider } from '#/lib/payment-provider'
import { processMollieWebhook } from './mollie'

// ---------------------------------------------------------------------------
// Stub payment provider — returns configurable webhook verification results
// ---------------------------------------------------------------------------

let stubVerifyResult = true
let stubPaymentStatus: 'pending' | 'paid' | 'expired' | 'failed' | 'cancelled' = 'paid'
let stubPaymentAmount = 1000

function createStubPaymentProvider(overrides?: Partial<PaymentProvider>): PaymentProvider {
  return {
    createPayment: async () => ({
      paymentId: 'tr_mock_000001',
      checkoutUrl: 'https://checkout.mollie.com/pay/tr_mock_000001',
    }),
    verifyWebhook: async () => stubVerifyResult,
    getPaymentStatus: async () => stubPaymentStatus,
    getPaymentAmount: async () => stubPaymentAmount,
    refundPayment: async () => undefined,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Database seed helpers
// ---------------------------------------------------------------------------

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

async function seedPlatformOrder(overrides?: Partial<typeof platformOrder.$inferInsert>) {
  return db
    .insert(platformOrder)
    .values({
      id: '10000000-0000-0000-0000-000000000042',
      userId: 'user-1',
      shippingAddress: { name: 'T', street: 'S', city: 'C', postalCode: '1', country: 'NL' },
      billingAddress: { name: 'T', street: 'S', city: 'C', postalCode: '1', country: 'NL' },
      totalCents: 1000,
      status: 'pending_payment',
      molliePaymentId: 'tr_mock_000042',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedShopOrder(overrides?: Partial<typeof shopOrder.$inferInsert>) {
  return db
    .insert(shopOrder)
    .values({
      platformOrderId: '10000000-0000-0000-0000-000000000042',
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 1000,
      status: 'pending_payment',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedCart(overrides?: Partial<typeof cart.$inferInsert>) {
  return db
    .insert(cart)
    .values({ userId: 'user-1', ...overrides })
    .returning()
    .then((rows) => rows[0])
}

async function seedProduct(overrides?: Partial<typeof product.$inferInsert>) {
  return db
    .insert(product)
    .values({
      id: 'prod-1',
      name: 'Test Product',
      slug: 'test-product',
      priceCents: 1000,
      stockCount: 10,
      shopId: 'shop-1',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedOrderItem(overrides?: Partial<typeof orderItem.$inferInsert>) {
  return db
    .insert(orderItem)
    .values({
      id: '00000000-0000-0000-0000-000000000001',
      shopOrderId: '00000000-0000-0000-0000-000000000002',
      productId: 'prod-1',
      productName: 'Test Product',
      unitPriceCents: 1000,
      quantity: 1,
      totalCents: 1000,
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedInventoryReservation(
  overrides?: Partial<typeof inventoryReservation.$inferInsert>,
) {
  return db
    .insert(inventoryReservation)
    .values({
      productId: 'prod-1',
      platformOrderId: '10000000-0000-0000-0000-000000000042',
      quantity: 1,
      expiresAt: new Date(Date.now() + 60_000),
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

// ---------------------------------------------------------------------------
// Helper: create a mock Request with JSON body and headers
// ---------------------------------------------------------------------------

function mockRequest(body: unknown, headers?: Record<string, string>): Request {
  const jsonBody = JSON.stringify(body)
  return new Request('https://example.com/api/webhooks/mollie', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: jsonBody,
  })
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  stubVerifyResult = true
  stubPaymentStatus = 'paid'
  stubPaymentAmount = 1000
  await db.delete(inventoryReservation)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(cartItem)
  await db.delete(cart)
  await db.delete(product)
  await db.delete(shop)
  await db.delete(user)

  // Seed base data needed by most tests
  await seedUser()
  await seedShop()
  await seedCart()
})

afterAll(async () => {
  stubVerifyResult = true
  stubPaymentStatus = 'paid'
  stubPaymentAmount = 1000
  await db.delete(inventoryReservation)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(cartItem)
  await db.delete(cart)
  await db.delete(product)
  await db.delete(shop)
  await db.delete(user)
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/mollie (processMollieWebhook)', () => {
  describe('signature verification', () => {
    it('returns 200 and updates order to paid when webhook signature is valid', async () => {
      const order = await seedPlatformOrder()
      const shopOrd = await seedShopOrder({ platformOrderId: order.id })

      const provider = createStubPaymentProvider()
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('processed')

      // Verify the platform order was updated to 'paid'
      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)

      expect(updatedOrder.status).toBe('paid')

      // Verify the shop order was updated to 'paid'
      const [updatedShopOrder] = await db
        .select({ status: shopOrder.status })
        .from(shopOrder)
        .where(eq(shopOrder.id, shopOrd.id))
        .limit(1)

      expect(updatedShopOrder.status).toBe('paid')
    })

    it('returns 401 when webhook signature is invalid', async () => {
      await seedPlatformOrder()

      stubVerifyResult = false
      const provider = createStubPaymentProvider()
      const req = mockRequest({ id: 'tr_mock_000042' }, { 'X-Mollie-Signature': 'wrong_signature' })

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('Unauthorized')
    })
  })

  describe('idempotency', () => {
    it('returns 200 without changes when order is already processed (already paid)', async () => {
      await seedPlatformOrder({
        id: '00000000-0000-0000-0000-000000000042',
        molliePaymentId: 'tr_mock_000042',
        status: 'paid',
      })

      const provider = createStubPaymentProvider()
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('already_processed')
    })

    it('returns 200 without changes when order is already cancelled', async () => {
      await seedPlatformOrder({
        id: '00000000-0000-0000-0000-000000000043',
        molliePaymentId: 'tr_mock_000042',
        status: 'cancelled',
      })

      const provider = createStubPaymentProvider()
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('already_processed')
    })
  })

  describe('unknown payment ID', () => {
    it('returns 200 with status unknown_payment for unrecognised payment ID', async () => {
      const provider = createStubPaymentProvider()
      const req = mockRequest(
        { id: 'tr_nonexistent_000001' },
        { 'X-Mollie-Signature': 'mock_sig_tr_nonexistent_000001' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('unknown_payment')
    })
  })

  describe('malformed input', () => {
    it('returns 400 for invalid JSON body', async () => {
      const provider = createStubPaymentProvider()
      const req = new Request('https://example.com/api/webhooks/mollie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json at all',
      })

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('Invalid JSON body')
    })

    it('returns 400 when JSON body is missing the id field', async () => {
      const provider = createStubPaymentProvider()
      const req = mockRequest({ status: 'paid' })

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('Missing payment ID')
    })

    it('returns 400 when id field is not a string', async () => {
      const provider = createStubPaymentProvider()
      const req = mockRequest({ id: 12345 })

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Bad Request')
    })

    it('returns 400 when id field is an empty string', async () => {
      const provider = createStubPaymentProvider()
      const req = mockRequest({ id: '' })

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('Missing payment ID')
    })

    it('returns 400 when verifyWebhook throws TypeError (malformed signature)', async () => {
      const provider = createStubPaymentProvider({
        verifyWebhook: async () => {
          throw new TypeError('Malformed signature')
        },
      })
      const req = mockRequest({ id: 'tr_mock_000042' }, { 'X-Mollie-Signature': 'bad' })

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('Malformed signature')
    })

    it('returns 400 when verifyWebhook throws RangeError (malformed signature)', async () => {
      const provider = createStubPaymentProvider({
        verifyWebhook: async () => {
          throw new RangeError('Malformed signature')
        },
      })
      const req = mockRequest({ id: 'tr_mock_000042' }, { 'X-Mollie-Signature': 'bad' })

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('Malformed signature')
    })
  })

  describe('idempotent webhook replay', () => {
    it('handles duplicate webhook delivery (same payment ID received twice)', async () => {
      const order = await seedPlatformOrder()
      await seedShopOrder({ platformOrderId: order.id })

      const provider = createStubPaymentProvider()
      const req = () =>
        mockRequest({ id: 'tr_mock_000042' }, { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' })

      // First delivery — should process
      const res1 = await processMollieWebhook(req(), { db, paymentProvider: provider })
      expect(res1.status).toBe(200)
      const body1 = await res1.json()
      expect(body1.status).toBe('processed')

      // Second delivery (replay) — should be idempotent
      const res2 = await processMollieWebhook(req(), { db, paymentProvider: provider })
      expect(res2.status).toBe(200)
      const body2 = await res2.json()
      expect(body2.status).toBe('already_processed')
    })
  })

  describe('payment status handling', () => {
    it('cancels the order and releases stock when payment status is expired', async () => {
      stubPaymentStatus = 'expired'
      const order = await seedPlatformOrder()
      const shopOrd = await seedShopOrder({ platformOrderId: order.id })
      await seedProduct()
      await seedOrderItem({ shopOrderId: shopOrd.id })
      await seedInventoryReservation()

      const provider = createStubPaymentProvider()
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('cancelled')

      const [updatedOrder] = await db
        .select({ status: platformOrder.status, cancelledAt: platformOrder.cancelledAt })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('cancelled')
      expect(updatedOrder.cancelledAt).not.toBeNull()

      const [updatedShopOrder] = await db
        .select({ status: shopOrder.status })
        .from(shopOrder)
        .where(eq(shopOrder.id, shopOrd.id))
        .limit(1)
      expect(updatedShopOrder.status).toBe('cancelled')

      const reservations = await db
        .select()
        .from(inventoryReservation)
        .where(eq(inventoryReservation.platformOrderId, order.id))
      expect(reservations).toHaveLength(0)
    })

    it('cancels the order and releases stock when payment status is failed', async () => {
      stubPaymentStatus = 'failed'
      const order = await seedPlatformOrder()
      const shopOrd = await seedShopOrder({ platformOrderId: order.id })
      await seedProduct()
      await seedOrderItem({ shopOrderId: shopOrd.id })
      await seedInventoryReservation()

      const provider = createStubPaymentProvider()
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('cancelled')

      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('cancelled')

      const reservations = await db
        .select()
        .from(inventoryReservation)
        .where(eq(inventoryReservation.platformOrderId, order.id))
      expect(reservations).toHaveLength(0)
    })

    it('cancels the order and releases stock when payment status is cancelled', async () => {
      stubPaymentStatus = 'cancelled'
      const order = await seedPlatformOrder()
      const shopOrd = await seedShopOrder({ platformOrderId: order.id })
      await seedProduct()
      await seedOrderItem({ shopOrderId: shopOrd.id })
      await seedInventoryReservation()

      const provider = createStubPaymentProvider()
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('cancelled')

      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('cancelled')

      const reservations = await db
        .select()
        .from(inventoryReservation)
        .where(eq(inventoryReservation.platformOrderId, order.id))
      expect(reservations).toHaveLength(0)
    })

    it('returns 200 without changes when payment status is still pending', async () => {
      stubPaymentStatus = 'pending'
      const order = await seedPlatformOrder()
      await seedShopOrder({ platformOrderId: order.id })

      const provider = createStubPaymentProvider()
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('pending')

      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('pending_payment')
    })

    it('is idempotent after cancellation via webhook', async () => {
      stubPaymentStatus = 'expired'
      const order = await seedPlatformOrder()
      const shopOrd = await seedShopOrder({ platformOrderId: order.id })
      await seedProduct()
      await seedOrderItem({ shopOrderId: shopOrd.id })
      await seedInventoryReservation()

      const provider = createStubPaymentProvider()
      const req = () =>
        mockRequest({ id: 'tr_mock_000042' }, { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' })

      // First delivery — should cancel
      const res1 = await processMollieWebhook(req(), { db, paymentProvider: provider })
      expect(res1.status).toBe(200)
      const body1 = await res1.json()
      expect(body1.status).toBe('cancelled')

      // Second delivery (replay) — should be idempotent
      const res2 = await processMollieWebhook(req(), { db, paymentProvider: provider })
      expect(res2.status).toBe(200)
      const body2 = await res2.json()
      expect(body2.status).toBe('already_processed')
    })
  })

  describe('amount verification', () => {
    it('does not mark order as paid when webhook amount is lower than order total', async () => {
      stubPaymentAmount = 500
      const order = await seedPlatformOrder({ totalCents: 1000 })
      await seedShopOrder({ platformOrderId: order.id })

      const provider = createStubPaymentProvider()
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('amount_mismatch')

      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('pending_payment')
    })

    it('does not mark order as paid when webhook amount is higher than order total', async () => {
      stubPaymentAmount = 1500
      const order = await seedPlatformOrder({ totalCents: 1000 })
      await seedShopOrder({ platformOrderId: order.id })

      const provider = createStubPaymentProvider()
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('amount_mismatch')

      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('pending_payment')
    })

    it('marks order as paid when webhook amount matches order total exactly', async () => {
      stubPaymentAmount = 2500
      const order = await seedPlatformOrder({ totalCents: 2500 })
      const shopOrd = await seedShopOrder({ platformOrderId: order.id })

      const provider = createStubPaymentProvider()
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('processed')

      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('paid')

      const [updatedShopOrder] = await db
        .select({ status: shopOrder.status })
        .from(shopOrder)
        .where(eq(shopOrder.id, shopOrd.id))
        .limit(1)
      expect(updatedShopOrder.status).toBe('paid')
    })
  })

  describe('stock decrement on payment', () => {
    it('decrements product stock and deletes reservation when payment is paid', async () => {
      stubPaymentStatus = 'paid'
      const order = await seedPlatformOrder()
      const shopOrd = await seedShopOrder({ platformOrderId: order.id })
      const prod = await seedProduct({ stockCount: 10 })
      await seedOrderItem({ shopOrderId: shopOrd.id, productId: prod.id, quantity: 3 })
      await seedInventoryReservation({ productId: prod.id, platformOrderId: order.id, quantity: 3 })

      const provider = createStubPaymentProvider()
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('processed')

      const [updatedProduct] = await db.select().from(product).where(eq(product.id, prod.id))
      expect(updatedProduct.stockCount).toBe(7)

      const reservations = await db
        .select()
        .from(inventoryReservation)
        .where(eq(inventoryReservation.platformOrderId, order.id))
      expect(reservations).toHaveLength(0)
    })

    it('does not double-decrement stock on idempotent replay', async () => {
      stubPaymentStatus = 'paid'
      const order = await seedPlatformOrder()
      const shopOrd = await seedShopOrder({ platformOrderId: order.id })
      const prod = await seedProduct({ stockCount: 10 })
      await seedOrderItem({ shopOrderId: shopOrd.id, productId: prod.id, quantity: 3 })
      await seedInventoryReservation({ productId: prod.id, platformOrderId: order.id, quantity: 3 })

      const provider = createStubPaymentProvider()
      const req = () =>
        mockRequest({ id: 'tr_mock_000042' }, { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' })

      const res1 = await processMollieWebhook(req(), { db, paymentProvider: provider })
      expect(res1.status).toBe(200)

      const res2 = await processMollieWebhook(req(), { db, paymentProvider: provider })
      expect(res2.status).toBe(200)

      const [updatedProduct] = await db.select().from(product).where(eq(product.id, prod.id))
      expect(updatedProduct.stockCount).toBe(7)
    })
  })

  describe('inventory verification on payment', () => {
    it('marks order for manual review when product is out of stock', async () => {
      stubPaymentStatus = 'paid'
      const order = await seedPlatformOrder()
      const shopOrd = await seedShopOrder({ platformOrderId: order.id })
      const prod = await seedProduct({ stockCount: 0 })
      await seedOrderItem({ shopOrderId: shopOrd.id, productId: prod.id, quantity: 1 })
      await seedInventoryReservation({ productId: prod.id, platformOrderId: order.id, quantity: 1 })

      const provider = createStubPaymentProvider()
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('inventory_mismatch')

      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('manual_review')

      const [updatedShopOrder] = await db
        .select({ status: shopOrder.status })
        .from(shopOrder)
        .where(eq(shopOrder.id, shopOrd.id))
        .limit(1)
      expect(updatedShopOrder.status).toBe('manual_review')

      // Stock should not be decremented
      const [updatedProduct] = await db.select().from(product).where(eq(product.id, prod.id))
      expect(updatedProduct.stockCount).toBe(0)

      // Reservation should be kept for manual review
      const reservations = await db
        .select()
        .from(inventoryReservation)
        .where(eq(inventoryReservation.platformOrderId, order.id))
      expect(reservations).toHaveLength(1)
    })

    it('marks order for manual review when ordered quantity exceeds available stock', async () => {
      stubPaymentStatus = 'paid'
      const order = await seedPlatformOrder()
      const shopOrd = await seedShopOrder({ platformOrderId: order.id })
      const prod = await seedProduct({ stockCount: 2 })
      await seedOrderItem({ shopOrderId: shopOrd.id, productId: prod.id, quantity: 5 })
      await seedInventoryReservation({ productId: prod.id, platformOrderId: order.id, quantity: 5 })

      const provider = createStubPaymentProvider()
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('inventory_mismatch')

      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('manual_review')

      // Stock should not be decremented
      const [updatedProduct] = await db.select().from(product).where(eq(product.id, prod.id))
      expect(updatedProduct.stockCount).toBe(2)
    })

    it('marks order for manual review when one of multiple products is out of stock', async () => {
      stubPaymentStatus = 'paid'
      const order = await seedPlatformOrder()
      const shopOrd = await seedShopOrder({ platformOrderId: order.id })
      const prod1 = await seedProduct({ id: 'prod-1', slug: 'test-product-1', stockCount: 5 })
      const prod2 = await seedProduct({ id: 'prod-2', slug: 'test-product-2', stockCount: 0 })
      await seedOrderItem({
        shopOrderId: shopOrd.id,
        productId: prod1.id,
        quantity: 2,
        id: '00000000-0000-0000-0000-000000000001',
      })
      await seedOrderItem({
        shopOrderId: shopOrd.id,
        productId: prod2.id,
        quantity: 1,
        id: '00000000-0000-0000-0000-000000000002',
      })
      await seedInventoryReservation({
        productId: prod1.id,
        platformOrderId: order.id,
        quantity: 2,
      })
      await seedInventoryReservation({
        productId: prod2.id,
        platformOrderId: order.id,
        quantity: 1,
      })

      const provider = createStubPaymentProvider()
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('inventory_mismatch')

      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('manual_review')

      // Neither product stock should be decremented
      const [updatedProd1] = await db.select().from(product).where(eq(product.id, prod1.id))
      expect(updatedProd1.stockCount).toBe(5)
      const [updatedProd2] = await db.select().from(product).where(eq(product.id, prod2.id))
      expect(updatedProd2.stockCount).toBe(0)
    })

    it('processes payment normally when stock exactly matches ordered quantity', async () => {
      stubPaymentStatus = 'paid'
      const order = await seedPlatformOrder()
      const shopOrd = await seedShopOrder({ platformOrderId: order.id })
      const prod = await seedProduct({ stockCount: 3 })
      await seedOrderItem({ shopOrderId: shopOrd.id, productId: prod.id, quantity: 3 })
      await seedInventoryReservation({ productId: prod.id, platformOrderId: order.id, quantity: 3 })

      const provider = createStubPaymentProvider()
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('processed')

      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('paid')

      const [updatedProduct] = await db.select().from(product).where(eq(product.id, prod.id))
      expect(updatedProduct.stockCount).toBe(0)
    })
  })

  describe('signature delivery', () => {
    it('passes rawBody to the payment provider for HMAC verification', async () => {
      await seedPlatformOrder()

      let receivedRawBody: string | undefined
      const provider: PaymentProvider = {
        createPayment: async () => ({
          paymentId: 'tr_mock_000001',
          checkoutUrl: 'https://checkout.mollie.com/pay/tr_mock_000001',
        }),
        verifyWebhook: async (_payload, _signature, rawBody) => {
          receivedRawBody = rawBody
          return true
        },
        getPaymentStatus: async () => 'paid',
        getPaymentAmount: async () => 1000,
        refundPayment: async () => undefined,
      }

      const payload = { id: 'tr_mock_000042' }
      const req = mockRequest(payload, { 'X-Mollie-Signature': 'valid_sig' })

      await processMollieWebhook(req, { db, paymentProvider: provider })

      expect(receivedRawBody).toBe(JSON.stringify(payload))
    })
  })

  describe('provider error handling', () => {
    it('returns 200 without updating order when getPaymentStatus throws', async () => {
      const order = await seedPlatformOrder()
      await seedShopOrder({ platformOrderId: order.id })

      const provider = createStubPaymentProvider({
        getPaymentStatus: async () => {
          throw new Error('Mollie API unavailable')
        },
      })
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('provider_error')

      // Order must remain untouched
      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('pending_payment')
    })

    it('returns 200 without updating order when getPaymentStatus rejects with non-Error', async () => {
      const order = await seedPlatformOrder()
      await seedShopOrder({ platformOrderId: order.id })

      const provider = createStubPaymentProvider({
        getPaymentStatus: async () => {
          throw 'string rejection'
        },
      })
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('provider_error')

      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('pending_payment')
    })
  })

  describe('Race Conditions', () => {
    it('prevents webhook from updating status to paid if the order was cancelled first', async () => {
      stubPaymentStatus = 'paid'
      const order = await seedPlatformOrder()
      await seedShopOrder({ platformOrderId: order.id })

      // User cancels the order first
      const cancelRes = await cancelOrderQuery(order.id, 'user-1')
      expect(cancelRes.success).toBe(true)

      // Now the webhook receives a paid status
      const provider = createStubPaymentProvider()
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('already_processed')

      // Status must remain cancelled
      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('cancelled')
    })

    it('prevents user cancellation if webhook processed the payment first', async () => {
      stubPaymentStatus = 'paid'
      const order = await seedPlatformOrder()
      await seedShopOrder({ platformOrderId: order.id })

      // Webhook processes payment first
      const provider = createStubPaymentProvider()
      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      const res = await processMollieWebhook(req, { db, paymentProvider: provider })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('processed')

      // User attempts to cancel the order afterwards
      await expect(cancelOrderQuery(order.id, 'user-1')).rejects.toBeInstanceOf(Response)

      // Status must remain paid
      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('paid')
    })

    it('handles concurrent race condition where webhook gets delayed and user cancels in between', async () => {
      stubPaymentStatus = 'paid'
      const order = await seedPlatformOrder()
      await seedShopOrder({ platformOrderId: order.id })

      // Create a provider with a delay in getPaymentStatus to simulate concurrent execution
      const provider = createStubPaymentProvider({
        getPaymentStatus: async () => {
          // Sleep to let cancelOrderQuery run and commit
          await new Promise((resolve) => setTimeout(resolve, 60))
          return 'paid'
        },
      })

      const req = mockRequest(
        { id: 'tr_mock_000042' },
        { 'X-Mollie-Signature': 'mock_sig_tr_mock_000042' },
      )

      // Start webhook processing (which will delay inside getPaymentStatus)
      const webhookPromise = processMollieWebhook(req, { db, paymentProvider: provider })

      // Start cancelOrderQuery immediately
      await new Promise((resolve) => setTimeout(resolve, 20))
      const cancelRes = await cancelOrderQuery(order.id, 'user-1')
      expect(cancelRes.success).toBe(true)

      // Wait for webhook to finish
      const res = await webhookPromise
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('already_processed')

      // Order status should be cancelled (not overwritten by paid)
      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('cancelled')
    })
  })
})
