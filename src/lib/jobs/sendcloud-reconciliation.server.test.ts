import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { shopOrder } from '#/db/schema'
import { getShippingProvider } from '#/integrations/shipping'
import type { ShippingProvider, TrackingInfo } from '#/lib/shipping-provider'
import { clearTestTables } from '#/test/cleanup'
import {
  createPlatformOrder,
  createShippingLabel,
  createShop,
  createShopOrder,
  createUser,
} from '#/test/factories'

import { flushBackgroundWorkForTests } from '../background-work.server'
import { reconcileSendcloudShipments } from './sendcloud-reconciliation.server'

vi.mock('#/integrations/shipping', () => ({
  getShippingProvider: vi.fn(),
}))

const mockTrackShipment = vi.fn<(trackingNumber: string) => Promise<TrackingInfo>>()

const mockProvider = {
  trackShipment: mockTrackShipment,
} as unknown as ShippingProvider

let testUser: Awaited<ReturnType<typeof createUser>>
let testShop: Awaited<ReturnType<typeof createShop>>

beforeEach(async () => {
  await clearTestTables()
  vi.mocked(getShippingProvider).mockReturnValue(mockProvider)
  mockTrackShipment.mockReset()
  testUser = await createUser()
  testShop = await createShop(testUser)
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

  await clearTestTables()
})

describe('reconcileSendcloudShipments', () => {
  it('marks shipped orders as delivered when provider reports delivered', async () => {
    const order = await createPlatformOrder(testUser, { totalCents: 1000 })
    const sOrder = await createShopOrder(order, testShop, {
      status: 'shipped',
      shippingCostCents: 500,
      subtotalCents: 1000,
    })
    await createShippingLabel(sOrder, {
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
      .select({
        status: shopOrder.status,
        deliveredAt: shopOrder.deliveredAt,
        trackingStatus: shopOrder.trackingStatus,
        lastTrackingEventAt: shopOrder.lastTrackingEventAt,
      })
      .from(shopOrder)
      .where(eq(shopOrder.id, sOrder.id))
      .limit(1)

    expect(updated.status).toBe('delivered')
    expect(updated.deliveredAt).not.toBeNull()
    expect(updated.trackingStatus).toBe('delivered')
    expect(updated.lastTrackingEventAt).toBeInstanceOf(Date)
  })

  it('does nothing when provider reports in_transit', async () => {
    const order = await createPlatformOrder(testUser, { totalCents: 1000 })
    const sOrder = await createShopOrder(order, testShop, {
      status: 'shipped',
      shippingCostCents: 500,
      subtotalCents: 1000,
    })
    await createShippingLabel(sOrder, {
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
    const order = await createPlatformOrder(testUser, { totalCents: 1000 })
    const sOrder = await createShopOrder(order, testShop, {
      status: 'shipped',
      shippingCostCents: 500,
      subtotalCents: 1000,
    })
    await createShippingLabel(sOrder, {
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
    const order = await createPlatformOrder(testUser, { totalCents: 1000 })
    const sOrder = await createShopOrder(order, testShop, {
      status: 'shipped',
      shippingCostCents: 500,
      subtotalCents: 1000,
    })
    await createShippingLabel(sOrder, {
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
