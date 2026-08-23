import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import {
  type cart,
  inventoryReservation,
  type orderItem,
  platformOrder,
  product,
  productVariant,
  type shop,
  shopOrder,
  type user,
} from '#/db/schema'
import { cancelOrderQuery } from '#/lib/orders.server'
import { flushBackgroundWorkForTests } from '#/lib/background-work.server'
import type { PaymentProvider } from '#/lib/payment-provider'
import { clearTestTables } from '#/test/cleanup'
import {
  createCart,
  createInventoryReservation,
  createOrderItem,
  createPlatformOrder,
  createProduct,
  createProductVariant,
  createShop,
  createShopOrder,
  createUser,
} from '#/test/factories'
import { processMollieWebhook } from './mollie'

// ---------------------------------------------------------------------------
// Stub payment provider — returns configurable authoritative payment state
// ---------------------------------------------------------------------------

let stubPaymentStatus: 'pending' | 'paid' | 'expired' | 'failed' | 'cancelled' | 'chargeback' =
  'paid'
let stubPaymentAmount = 1000

function createStubPaymentProvider(overrides?: Partial<PaymentProvider>): PaymentProvider {
  return {
    createPayment: async () => ({
      paymentId: 'tr_mock_000001',
      checkoutUrl: 'https://checkout.mollie.com/pay/tr_mock_000001',
    }),
    getPaymentStatus: async () => stubPaymentStatus,
    getPaymentAmount: async () => stubPaymentAmount,
    refundPayment: async () => undefined,
    cancelPayment: async () => undefined,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Database seed helpers (thin wrappers around shared factories; stable IDs are
// kept because the webhook payloads and cancellation assertions rely on them)
// ---------------------------------------------------------------------------

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  return createUser({
    id: 'user-1',
    name: 'Test',
    email: 'test@example.com',
    emailVerified: true,
    ...overrides,
  })
}

async function seedShop(overrides?: Partial<typeof shop.$inferInsert>) {
  return createShop('user-1', {
    id: 'shop-1',
    name: 'Test Shop',
    slug: 'test-shop',
    ...overrides,
  })
}

async function seedPlatformOrder(overrides?: Partial<typeof platformOrder.$inferInsert>) {
  return createPlatformOrder('user-1', {
    id: '10000000-0000-0000-0000-000000000042',
    shippingAddress: { name: 'T', street: 'S', city: 'C', postalCode: '1', country: 'NL' },
    billingAddress: { name: 'T', street: 'S', city: 'C', postalCode: '1', country: 'NL' },
    totalCents: 1000,
    status: 'pending_payment',
    molliePaymentId: 'tr_mock_000042',
    ...overrides,
  })
}

async function seedShopOrder(overrides?: Partial<typeof shopOrder.$inferInsert>) {
  const { platformOrderId, shopId, ...rest } = overrides ?? {}
  return createShopOrder(
    platformOrderId ?? '10000000-0000-0000-0000-000000000042',
    shopId ?? 'shop-1',
    {
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 1000,
      status: 'pending_payment',
      ...rest,
    },
  )
}

async function seedCart(overrides?: Partial<typeof cart.$inferInsert>) {
  return createCart('user-1', overrides)
}

async function seedProduct(overrides?: Partial<typeof product.$inferInsert>) {
  return createProduct('shop-1', {
    id: 'prod-1',
    name: 'Test Product',
    slug: 'test-product',
    priceCents: 1000,
    stockCount: 10,
    ...overrides,
  })
}

async function seedProductVariant(overrides?: Partial<typeof productVariant.$inferInsert>) {
  const { productId, ...rest } = overrides ?? {}
  return createProductVariant(productId ?? 'prod-1', {
    id: 'var-1',
    name: 'Standard',
    stockCount: 10,
    ...rest,
  })
}

async function seedOrderItem(overrides?: Partial<typeof orderItem.$inferInsert>) {
  const { shopOrderId, productId, ...rest } = overrides ?? {}
  return createOrderItem(
    shopOrderId ?? '00000000-0000-0000-0000-000000000002',
    { id: productId ?? 'prod-1', name: 'Test Product', priceCents: 1000 },
    {
      id: '00000000-0000-0000-0000-000000000001',
      quantity: 1,
      totalCents: 1000,
      ...rest,
    },
  )
}

async function seedInventoryReservation(
  overrides?: Partial<typeof inventoryReservation.$inferInsert>,
) {
  const { productId, ...rest } = overrides ?? {}
  return createInventoryReservation(productId ?? 'prod-1', {
    platformOrderId: '10000000-0000-0000-0000-000000000042',
    quantity: 1,
    expiresAt: new Date(Date.now() + 60_000),
    ...rest,
  })
}

// ---------------------------------------------------------------------------
// Helper: create a classic Mollie form-encoded callback request
// ---------------------------------------------------------------------------

function mockRequest(body: unknown, headers?: Record<string, string>): Request {
  const form = new URLSearchParams()
  if (body && typeof body === 'object') {
    for (const [key, value] of Object.entries(body)) {
      form.append(key, String(value))
    }
  }

  return new Request('https://example.com/api/webhooks/mollie', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body: form,
  })
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  stubPaymentStatus = 'paid'
  stubPaymentAmount = 1000
  await clearTestTables()

  // Seed base data needed by most tests
  await seedUser()
  await seedShop()
  await seedCart()
})

afterEach(async () => {
  // Invariant: every async side effect triggered by a test must settle before
  // the next beforeEach(clearTestTables). Request paths exercised here detach
  // post-commit work via `scheduleBackgroundWork`, which tracks chains under
  // VITEST precisely so they can be awaited. A chain left running overlaps the
  // next test's cleanup/fixtures: its backend interleaves with the DELETEs
  // (TRUNCATE historically) clearing parents, producing FK "not present"
  // failures on re-seeded ids (e.g. shop-1) and cross-backend lock cycles
  // (child-insert FK KEY SHARE vs cleanup row/table locks). No-op when
  // nothing was scheduled.
  await flushBackgroundWorkForTests()
})

afterAll(async () => {
  stubPaymentStatus = 'paid'
  stubPaymentAmount = 1000
  await clearTestTables()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/mollie (processMollieWebhook)', () => {
  describe('classic callback contract', () => {
    it('returns 200 and updates the order from authoritative provider state', async () => {
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

    it('does not require or trust a callback signature header', async () => {
      const order = await seedPlatformOrder()
      await seedShopOrder({ platformOrderId: order.id })

      const res = await processMollieWebhook(
        mockRequest({ id: 'tr_mock_000042' }, { 'X-Mollie-Signature': 'untrusted' }),
        { db, paymentProvider: createStubPaymentProvider() },
      )

      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toMatchObject({ status: 'processed' })
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
    it('returns 415 for a JSON callback instead of the classic form contract', async () => {
      const req = new Request('https://example.com/api/webhooks/mollie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'tr_mock_000042' }),
      })

      const res = await processMollieWebhook(req, {
        db,
        paymentProvider: createStubPaymentProvider(),
      })

      expect(res.status).toBe(415)
      await expect(res.json()).resolves.toMatchObject({ error: 'Unsupported Media Type' })
    })

    it('returns 400 when the form body is missing the id field', async () => {
      const res = await processMollieWebhook(mockRequest({}), {
        db,
        paymentProvider: createStubPaymentProvider(),
      })

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toMatchObject({
        error: 'Bad Request',
        message: 'Missing or duplicate payment ID',
      })
    })

    it('returns 400 when the payment id has an invalid shape', async () => {
      const res = await processMollieWebhook(mockRequest({ id: 12345 }), {
        db,
        paymentProvider: createStubPaymentProvider(),
      })

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toMatchObject({ error: 'Bad Request' })
    })

    it('returns 400 when the payment id is empty', async () => {
      const res = await processMollieWebhook(mockRequest({ id: '' }), {
        db,
        paymentProvider: createStubPaymentProvider(),
      })

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toMatchObject({ error: 'Bad Request' })
    })

    it('returns 413 before processing an oversized callback', async () => {
      const res = await processMollieWebhook(mockRequest({ id: `tr_${'a'.repeat(1100)}` }), {
        db,
        paymentProvider: createStubPaymentProvider(),
      })

      expect(res.status).toBe(413)
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
    it('cancels the order and retains its active reservation when payment status is expired', async () => {
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
      expect(reservations).toHaveLength(1)
    })

    it('cancels the order and retains its active reservation when payment status is failed', async () => {
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
      expect(reservations).toHaveLength(1)
    })

    it('cancels the order and retains its active reservation when payment status is cancelled', async () => {
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
      expect(reservations).toHaveLength(1)
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
      expect(updatedOrder.status).toBe('manual_review')
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
      expect(updatedOrder.status).toBe('manual_review')
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

    it('decrements variant stock and deletes reservation when payment is paid', async () => {
      stubPaymentStatus = 'paid'
      const order = await seedPlatformOrder()
      const shopOrd = await seedShopOrder({ platformOrderId: order.id })
      const prod = await seedProduct({ stockCount: 10 })
      const variant = await seedProductVariant({ productId: prod.id, stockCount: 8 })
      await seedOrderItem({
        shopOrderId: shopOrd.id,
        productId: prod.id,
        variantId: variant.id,
        quantity: 3,
      })
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

      // Variant stock should be decremented, product stock untouched
      const [updatedVariant] = await db
        .select()
        .from(productVariant)
        .where(eq(productVariant.id, variant.id))
      expect(updatedVariant.stockCount).toBe(5)

      const [updatedProduct] = await db.select().from(product).where(eq(product.id, prod.id))
      expect(updatedProduct.stockCount).toBe(10)

      // Reservation should be removed
      const reservations = await db
        .select()
        .from(inventoryReservation)
        .where(eq(inventoryReservation.platformOrderId, order.id))
      expect(reservations).toHaveLength(0)
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

  describe('authoritative provider lookup', () => {
    it('retrieves the exact form-encoded payment id from the provider', async () => {
      const order = await seedPlatformOrder()
      await seedShopOrder({ platformOrderId: order.id })

      let receivedPaymentId: string | undefined
      const provider = createStubPaymentProvider({
        getPaymentStatus: async (paymentId) => {
          receivedPaymentId = paymentId
          return 'paid'
        },
      })

      await processMollieWebhook(mockRequest({ id: 'tr_mock_000042' }), {
        db,
        paymentProvider: provider,
      })

      expect(receivedPaymentId).toBe('tr_mock_000042')
    })
  })

  describe('provider error handling', () => {
    it('returns 503 for retry without updating the order when Mollie is unavailable', async () => {
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

      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.status).toBe('provider_or_processing_error')

      // Order must remain untouched
      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('pending_payment')
    })

    it('returns 503 when getPaymentStatus rejects with a non-Error value', async () => {
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

      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.status).toBe('provider_or_processing_error')

      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('pending_payment')
    })
  })

  describe('Race Conditions', () => {
    it('refunds a captured payment if the order was cancelled first', async () => {
      stubPaymentStatus = 'paid'
      stubPaymentAmount = 1500
      const order = await seedPlatformOrder({ totalCents: 1500 })
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
      expect(body.status).toBe('refunded_after_cancellation')

      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('refunded')
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

    it('refunds when cancellation commits during the provider lookup', async () => {
      stubPaymentStatus = 'paid'
      stubPaymentAmount = 1500
      const order = await seedPlatformOrder({ totalCents: 1500 })
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
      expect(body.status).toBe('refunded_after_cancellation')

      const [updatedOrder] = await db
        .select({ status: platformOrder.status })
        .from(platformOrder)
        .where(eq(platformOrder.id, order.id))
        .limit(1)
      expect(updatedOrder.status).toBe('refunded')
    })
  })
})
