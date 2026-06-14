import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import {
  platformOrder,
  sendcloudWebhookEvent,
  shippingLabel,
  shop,
  shopOrder,
  user,
} from '#/db/schema'
import { flushBackgroundWorkForTests } from '#/lib/background-work.server'
import { processSendcloudWebhook } from './sendcloud'

// ---------------------------------------------------------------------------
// Database seed helpers
// ---------------------------------------------------------------------------

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  return db
    .insert(user)
    .values({
      id: 'sendcloud-user-1',
      name: 'Sendcloud Test',
      email: 'sendcloud-test@example.com',
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
      id: 'sendcloud-shop-1',
      name: 'Sendcloud Test Shop',
      slug: 'sendcloud-test-shop',
      ownerId: 'sendcloud-user-1',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedPlatformOrder(overrides?: Partial<typeof platformOrder.$inferInsert>) {
  return db
    .insert(platformOrder)
    .values({
      id: '10000000-0000-0000-0000-000000000123',
      userId: 'sendcloud-user-1',
      shippingAddress: { name: 'T', street: 'S', city: 'C', postalCode: '1', country: 'NL' },
      billingAddress: { name: 'T', street: 'S', city: 'C', postalCode: '1', country: 'NL' },
      totalCents: 1000,
      status: 'shipped',
      molliePaymentId: 'tr_mock_000123',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedShopOrder(overrides?: Partial<typeof shopOrder.$inferInsert>) {
  return db
    .insert(shopOrder)
    .values({
      platformOrderId: '10000000-0000-0000-0000-000000000123',
      shopId: 'sendcloud-shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 1000,
      status: 'shipped',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedShippingLabel(overrides?: Partial<typeof shippingLabel.$inferInsert>) {
  return db
    .insert(shippingLabel)
    .values({
      shopOrderId: '00000000-0000-0000-0000-000000000000',
      carrier: 'sendcloud',
      trackingNumber: 'SC12345678',
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
  return new Request('https://example.com/api/webhooks/sendcloud', {
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
  await db.delete(sendcloudWebhookEvent)
  await db.delete(shippingLabel)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(shop)
  await db.delete(user)

  await seedUser()
  await seedShop()
})

afterEach(async () => {
  await db.delete(shippingLabel)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(shop)
  await db.delete(user)
  await db.delete(sendcloudWebhookEvent)
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/sendcloud (processSendcloudWebhook)', () => {
  it('logs the webhook event and marks the order delivered on delivered status', async () => {
    const platformOrd = await seedPlatformOrder()
    const shopOrd = await seedShopOrder({ platformOrderId: platformOrd.id, status: 'shipped' })
    await seedShippingLabel({ shopOrderId: shopOrd.id, trackingNumber: 'SC12345678' })

    const req = mockRequest(
      {
        action: 'parcel_status',
        parcel: {
          id: 12345,
          tracking_number: 'SC12345678',
          status: { message: 'Delivered' },
        },
      },
      { 'Sendcloud-Signature': 'valid_sig' },
    )

    const res = await processSendcloudWebhook(req, {
      db,
      verifySignature: async () => true,
      secret: 'test-secret',
    })

    // Allow scheduled payout work to finish before cleanup removes the rows.
    await flushBackgroundWorkForTests()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('processed')

    const [updatedShopOrder] = await db
      .select({ status: shopOrder.status })
      .from(shopOrder)
      .where(eq(shopOrder.id, shopOrd.id))
      .limit(1)

    expect(updatedShopOrder?.status).toBe('delivered')

    const [event] = await db
      .select()
      .from(sendcloudWebhookEvent)
      .where(eq(sendcloudWebhookEvent.trackingNumber, 'SC12345678'))
      .limit(1)

    expect(event).toBeDefined()
    expect(event?.trackingNumber).toBe('SC12345678')
    expect(event?.processedAt).not.toBeNull()
    expect(event?.error).toBeNull()
  })

  it('logs the event and returns 401 for an invalid signature', async () => {
    const req = mockRequest(
      {
        action: 'parcel_status',
        parcel: {
          id: 12345,
          tracking_number: 'SC12345678',
          status: { message: 'Delivered' },
        },
      },
      { 'Sendcloud-Signature': 'invalid_sig' },
    )

    const res = await processSendcloudWebhook(req, {
      db,
      verifySignature: async () => false,
      secret: 'test-secret',
    })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.status).toBe('Unauthorized')

    const [event] = await db
      .select()
      .from(sendcloudWebhookEvent)
      .where(eq(sendcloudWebhookEvent.trackingNumber, 'SC12345678'))
      .limit(1)

    expect(event).toBeDefined()
    expect(event?.error).toBe('invalid_signature')
    expect(event?.processedAt).not.toBeNull()
  })

  it('logs the event and returns 200 for an unknown tracking number', async () => {
    const req = mockRequest(
      {
        action: 'parcel_status',
        parcel: {
          id: 99999,
          tracking_number: 'SC99999999',
          status: { message: 'Delivered' },
        },
      },
      { 'Sendcloud-Signature': 'valid_sig' },
    )

    const res = await processSendcloudWebhook(req, {
      db,
      verifySignature: async () => true,
      secret: 'test-secret',
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('unknown_tracking')

    const [event] = await db
      .select()
      .from(sendcloudWebhookEvent)
      .where(eq(sendcloudWebhookEvent.trackingNumber, 'SC99999999'))
      .limit(1)

    expect(event).toBeDefined()
    expect(event?.error).toBe('unknown_tracking_number')
    expect(event?.processedAt).not.toBeNull()
  })
})
