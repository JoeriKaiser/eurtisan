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
import type { PaymentProvider } from '#/lib/payment-provider'
import { processMollieWebhook } from './mollie'

// ---------------------------------------------------------------------------
// Stub payment provider — returns configurable webhook verification results
// ---------------------------------------------------------------------------

let stubVerifyResult = true

function createStubPaymentProvider(overrides?: Partial<PaymentProvider>): PaymentProvider {
  return {
    createPayment: async () => ({
      paymentId: 'tr_mock_000001',
      checkoutUrl: 'https://checkout.mollie.com/pay/tr_mock_000001',
    }),
    verifyWebhook: async () => stubVerifyResult,
    getPaymentStatus: async () => 'paid',
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
        refundPayment: async () => undefined,
      }

      const payload = { id: 'tr_mock_000042' }
      const req = mockRequest(payload, { 'X-Mollie-Signature': 'valid_sig' })

      await processMollieWebhook(req, { db, paymentProvider: provider })

      expect(receivedRawBody).toBe(JSON.stringify(payload))
    })
  })
})
