import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import {
  type platformOrder,
  sendcloudWebhookEvent,
  type shippingLabel,
  type shop,
  shopOrder,
  type user,
} from '#/db/schema'
import { flushBackgroundWorkForTests } from '#/lib/background-work.server'
import { clearTestTables } from '#/test/cleanup'
import {
  createPlatformOrder,
  createShippingLabel,
  createShop,
  createShopOrder,
  createUser,
} from '#/test/factories'
import { processSendcloudWebhook } from './sendcloud'

// ---------------------------------------------------------------------------
// Database seed helpers (thin wrappers around shared factories)
// ---------------------------------------------------------------------------

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  return createUser({
    id: 'sendcloud-user-1',
    name: 'Sendcloud Test',
    email: 'sendcloud-test@example.com',
    emailVerified: true,
    ...overrides,
  })
}

async function seedShop(overrides?: Partial<typeof shop.$inferInsert>) {
  return createShop('sendcloud-user-1', {
    id: 'sendcloud-shop-1',
    name: 'Sendcloud Test Shop',
    slug: 'sendcloud-test-shop',
    ...overrides,
  })
}

async function seedPlatformOrder(overrides?: Partial<typeof platformOrder.$inferInsert>) {
  return createPlatformOrder('sendcloud-user-1', {
    id: '10000000-0000-0000-0000-000000000123',
    shippingAddress: { name: 'T', street: 'S', city: 'C', postalCode: '1', country: 'NL' },
    billingAddress: { name: 'T', street: 'S', city: 'C', postalCode: '1', country: 'NL' },
    totalCents: 1000,
    status: 'shipped',
    molliePaymentId: 'tr_mock_000123',
    ...overrides,
  })
}

async function seedShopOrder(overrides?: Partial<typeof shopOrder.$inferInsert>) {
  return createShopOrder('10000000-0000-0000-0000-000000000123', 'sendcloud-shop-1', {
    shippingMethod: 'standard',
    shippingCostCents: 500,
    subtotalCents: 1000,
    status: 'shipped',
    ...overrides,
  })
}

async function seedShippingLabel(overrides?: Partial<typeof shippingLabel.$inferInsert>) {
  return createShippingLabel('00000000-0000-0000-0000-000000000000', {
    carrier: 'sendcloud',
    trackingNumber: 'SC12345678',
    ...overrides,
  })
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
  await clearTestTables()

  await seedUser()
  await seedShop()
})

afterEach(async () => {
  await clearTestTables()
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
      .select({
        status: shopOrder.status,
        trackingStatus: shopOrder.trackingStatus,
        lastTrackingEventAt: shopOrder.lastTrackingEventAt,
      })
      .from(shopOrder)
      .where(eq(shopOrder.id, shopOrd.id))
      .limit(1)

    expect(updatedShopOrder?.status).toBe('delivered')
    expect(updatedShopOrder?.trackingStatus).toBe('delivered')
    expect(updatedShopOrder?.lastTrackingEventAt).toBeInstanceOf(Date)

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
