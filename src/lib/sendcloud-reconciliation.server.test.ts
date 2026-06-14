import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import {
  notification,
  payout,
  payoutReconciliationLog,
  platformOrder,
  shippingLabel,
  shop,
  shopOrder,
  user,
} from '#/db/schema'
import { getShippingProvider } from '#/integrations/shipping'
import type { ShippingProvider, TrackingInfo } from '#/lib/shipping-provider'

import { reconcileSendcloudShipments } from './sendcloud-reconciliation.server'

vi.mock('#/integrations/shipping', () => ({
  getShippingProvider: vi.fn(),
}))

const mockTrackShipment = vi.fn<(trackingNumber: string) => Promise<TrackingInfo>>()

const mockProvider = {
  trackShipment: mockTrackShipment,
} as unknown as ShippingProvider

async function cleanupTables() {
  await db.delete(payoutReconciliationLog)
  await db.delete(payout)
  await db.delete(notification)
  await db.delete(shippingLabel)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(shop)
  await db.delete(user)
}

async function seedUser() {
  return db
    .insert(user)
    .values({ id: 'user-1', name: 'Test', email: 'test@example.com', emailVerified: true })
    .returning()
    .then((rows) => rows[0])
}

async function seedShop() {
  return db
    .insert(shop)
    .values({ id: 'shop-1', name: 'Test Shop', slug: 'test-shop', ownerId: 'user-1' })
    .returning()
    .then((rows) => rows[0])
}

async function seedPlatformOrder(overrides?: Partial<typeof platformOrder.$inferInsert>) {
  return db
    .insert(platformOrder)
    .values({
      userId: 'user-1',
      shippingAddress: { name: 'T', street: 'S', city: 'C', postalCode: '1', country: 'NL' },
      billingAddress: { name: 'T', street: 'S', city: 'C', postalCode: '1', country: 'NL' },
      totalCents: 1000,
      status: 'paid',
      molliePaymentId: 'tr_mock_000001',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedShopOrder(
  platformOrderId: string,
  overrides?: Partial<typeof shopOrder.$inferInsert>,
) {
  return db
    .insert(shopOrder)
    .values({
      platformOrderId,
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 1000,
      status: 'shipped',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedShippingLabel(
  shopOrderId: string,
  overrides?: Partial<typeof shippingLabel.$inferInsert>,
) {
  return db
    .insert(shippingLabel)
    .values({
      shopOrderId,
      carrier: 'sendcloud',
      trackingNumber: 'SC123',
      labelUrl: 'https://example.com/label.pdf',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

beforeEach(async () => {
  await cleanupTables()
  vi.mocked(getShippingProvider).mockReturnValue(mockProvider)
  mockTrackShipment.mockReset()
  await seedUser()
  await seedShop()
})

afterEach(async () => {
  await cleanupTables()
})

describe('reconcileSendcloudShipments', () => {
  it('marks shipped orders as delivered when provider reports delivered', async () => {
    const order = await seedPlatformOrder()
    const sOrder = await seedShopOrder(order.id)
    await seedShippingLabel(sOrder.id, {
      trackingNumber: 'SC123',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    })

    mockTrackShipment.mockResolvedValue({
      status: 'delivered',
      trackingNumber: 'SC123',
      carrier: 'sendcloud',
      events: [],
    })

    const result = await reconcileSendcloudShipments({ graceHours: 0 })

    expect(result).toEqual({ checked: 1, updated: 1, errors: 0 })

    const [updated] = await db
      .select({ status: shopOrder.status, deliveredAt: shopOrder.deliveredAt })
      .from(shopOrder)
      .where(eq(shopOrder.id, sOrder.id))
      .limit(1)

    expect(updated.status).toBe('delivered')
    expect(updated.deliveredAt).not.toBeNull()
  })

  it('does nothing when provider reports in_transit', async () => {
    const order = await seedPlatformOrder()
    const sOrder = await seedShopOrder(order.id)
    await seedShippingLabel(sOrder.id, {
      trackingNumber: 'SC123',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    })

    mockTrackShipment.mockResolvedValue({
      status: 'in_transit',
      trackingNumber: 'SC123',
      carrier: 'sendcloud',
      events: [],
    })

    const result = await reconcileSendcloudShipments({ graceHours: 0 })

    expect(result).toEqual({ checked: 1, updated: 0, errors: 0 })

    const [updated] = await db
      .select({ status: shopOrder.status })
      .from(shopOrder)
      .where(eq(shopOrder.id, sOrder.id))
      .limit(1)

    expect(updated.status).toBe('shipped')
  })

  it('counts errors when provider throws', async () => {
    const order = await seedPlatformOrder()
    const sOrder = await seedShopOrder(order.id)
    await seedShippingLabel(sOrder.id, {
      trackingNumber: 'SC123',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    })

    mockTrackShipment.mockRejectedValue(new Error('tracking failed'))

    const result = await reconcileSendcloudShipments({ graceHours: 0 })

    expect(result).toEqual({ checked: 1, updated: 0, errors: 1 })

    const [updated] = await db
      .select({ status: shopOrder.status })
      .from(shopOrder)
      .where(eq(shopOrder.id, sOrder.id))
      .limit(1)

    expect(updated.status).toBe('shipped')
  })

  it('skips labels newer than the grace period', async () => {
    const order = await seedPlatformOrder()
    const sOrder = await seedShopOrder(order.id)
    await seedShippingLabel(sOrder.id, {
      trackingNumber: 'SC123',
      createdAt: new Date(Date.now() + 60_000),
    })

    const result = await reconcileSendcloudShipments({ graceHours: 0 })

    expect(result).toEqual({ checked: 0, updated: 0, errors: 0 })
    expect(mockTrackShipment).not.toHaveBeenCalled()

    const [updated] = await db
      .select({ status: shopOrder.status })
      .from(shopOrder)
      .where(eq(shopOrder.id, sOrder.id))
      .limit(1)

    expect(updated.status).toBe('shipped')
  })
})
