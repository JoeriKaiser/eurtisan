import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import { shopOrder } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import { createPlatformOrder, createShop, createShopOrder, createUser } from '#/test/factories'
import { getDac7ComplianceStatus } from './dac7.server'

describe('DAC7 Threshold Engine', () => {
  const currentYear = new Date().getFullYear()

  beforeEach(async () => {
    await clearTestTables()

    // Seed base user and shop
    const creator = await createUser({
      id: 'creator-user',
      name: 'Alice Artisan',
      email: 'alice@artisan.de',
      role: 'creator',
    })

    await createShop(creator, {
      id: 'shop-1',
      name: 'Alice Store',
      slug: 'alice-store',
      isVatRegistered: false,
    })

    await createUser({
      id: 'buyer-user',
      name: 'Bob Buyer',
      email: 'bob@buyer.com',
      role: 'customer',
    })
  })

  afterAll(async () => {
    await clearTestTables()
  })

  it('returns zero transactions and sales if no orders exist', async () => {
    const status = await getDac7ComplianceStatus('shop-1', currentYear)
    expect(status).toEqual({
      transactionCount: 0,
      grossSalesCents: 0,
      approachingLimit: false,
      exceededLimit: false,
    })
  })

  it('aggregates completed and delivered orders for the correct calendar year', async () => {
    // Insert a platform order
    const platformOrder = await createPlatformOrder('buyer-user', {
      id: 'a1111111-1111-1111-1111-111111111111',
      totalCents: 3500,
      status: 'paid',
    })

    // Insert completed order in current year
    await createShopOrder(platformOrder, 'shop-1', {
      id: 'b1111111-1111-1111-1111-111111111111',
      status: 'completed',
      subtotalCents: 2000,
      shippingCostCents: 500,
      createdAt: new Date(`${currentYear}-06-15T12:00:00Z`),
    })

    // Insert delivered order in current year
    await createShopOrder(platformOrder, 'shop-1', {
      id: 'b2222222-2222-2222-2222-222222222222',
      status: 'delivered',
      subtotalCents: 1000,
      shippingCostCents: 0,
      createdAt: new Date(`${currentYear}-08-20T12:00:00Z`),
    })

    // Insert a pending payment order (should NOT be aggregated)
    await createShopOrder(platformOrder, 'shop-1', {
      id: 'b3333333-3333-3333-3333-333333333333',
      status: 'pending_payment',
      subtotalCents: 5000,
      shippingCostCents: 1000,
      createdAt: new Date(`${currentYear}-09-01T12:00:00Z`),
    })

    // Insert order in different year (should NOT be aggregated)
    const diffYear = currentYear - 1
    await createShopOrder(platformOrder, 'shop-1', {
      id: 'b4444444-4444-4444-4444-444444444444',
      status: 'completed',
      subtotalCents: 5000,
      shippingCostCents: 500,
      createdAt: new Date(`${diffYear}-06-15T12:00:00Z`),
    })

    const status = await getDac7ComplianceStatus('shop-1', currentYear)
    expect(status.transactionCount).toBe(2)
    // 2000 subtotal + 500 shipping + 1000 subtotal + 0 shipping = 3500 cents
    expect(status.grossSalesCents).toBe(3500)
    expect(status.approachingLimit).toBe(false)
    expect(status.exceededLimit).toBe(false)
  })

  it('correctly flags approaching limit (24 transactions or €1,600 revenue)', async () => {
    const platformOrder = await createPlatformOrder('buyer-user', {
      id: 'a1111111-1111-1111-1111-111111111111',
      totalCents: 200000,
      status: 'paid',
    })

    // 1. Test volume threshold: 24 completed orders
    for (let i = 0; i < 24; i++) {
      await createShopOrder(platformOrder, 'shop-1', {
        id: `b1000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
        status: 'completed',
        subtotalCents: 10,
        shippingCostCents: 0,
        createdAt: new Date(`${currentYear}-01-01T12:00:00Z`),
      })
    }

    let status = await getDac7ComplianceStatus('shop-1', currentYear)
    expect(status.transactionCount).toBe(24)
    expect(status.approachingLimit).toBe(true)
    expect(status.exceededLimit).toBe(false)

    // Clean up orders for next threshold check
    await db.delete(shopOrder)

    // 2. Test revenue threshold: €1,600 gross sales (160,000 cents)
    await createShopOrder(platformOrder, 'shop-1', {
      id: 'b2000000-0000-0000-0000-000000000001',
      status: 'completed',
      subtotalCents: 155000,
      shippingCostCents: 5000, // €1,550 + €50 = €1,600 (160,000 cents)
      createdAt: new Date(`${currentYear}-01-01T12:00:00Z`),
    })

    status = await getDac7ComplianceStatus('shop-1', currentYear)
    expect(status.grossSalesCents).toBe(160000)
    expect(status.approachingLimit).toBe(true)
    expect(status.exceededLimit).toBe(false)
  })

  it('correctly flags exceeded limit (30 transactions or €2,000 revenue)', async () => {
    const platformOrder = await createPlatformOrder('buyer-user', {
      id: 'a1111111-1111-1111-1111-111111111111',
      totalCents: 300000,
      status: 'paid',
    })

    // 1. Test volume threshold: 30 completed orders
    for (let i = 0; i < 30; i++) {
      await createShopOrder(platformOrder, 'shop-1', {
        id: `b1000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
        status: 'completed',
        subtotalCents: 10,
        shippingCostCents: 0,
        createdAt: new Date(`${currentYear}-01-01T12:00:00Z`),
      })
    }

    let status = await getDac7ComplianceStatus('shop-1', currentYear)
    expect(status.transactionCount).toBe(30)
    expect(status.approachingLimit).toBe(true)
    expect(status.exceededLimit).toBe(true)

    // Clean up orders for next threshold check
    await db.delete(shopOrder)

    // 2. Test revenue threshold: €2,000 gross sales (200,000 cents)
    await createShopOrder(platformOrder, 'shop-1', {
      id: 'b2000000-0000-0000-0000-000000000001',
      status: 'completed',
      subtotalCents: 195000,
      shippingCostCents: 5000, // €1,950 + €50 = €2,000 (200,000 cents)
      createdAt: new Date(`${currentYear}-01-01T12:00:00Z`),
    })

    status = await getDac7ComplianceStatus('shop-1', currentYear)
    expect(status.grossSalesCents).toBe(200000)
    expect(status.approachingLimit).toBe(true)
    expect(status.exceededLimit).toBe(true)
  })
})
