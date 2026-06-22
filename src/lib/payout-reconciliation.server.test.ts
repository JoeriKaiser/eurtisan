import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/index'
import { payout, payoutReconciliationLog } from '#/db/schema'
import {
  resetMockRouteStatus,
  setMockRouteStatus,
} from '#/integrations/mollie/mollie-routes-client'
import { clearTestTables } from '#/test/cleanup'
import { createPlatformOrder, createShop, createShopOrder, createUser } from '#/test/factories'
import { reconcilePayouts } from './payout-reconciliation.server'

async function seedUser() {
  return createUser({ id: 'user-1' })
}

async function seedShop() {
  return createShop('user-1', {
    id: 'shop-1',
    name: 'Test Shop',
    slug: 'test-shop',
    mollieAccountId: 'org_test',
    paymentConnected: true,
  })
}

function mockFetchRefunds(
  refunds: Array<{ id: string; amount: { value: string }; status: string }>,
) {
  return vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (url.includes('/refunds')) {
      return new Response(JSON.stringify({ refunds }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ error: 'unexpected mock call' }), { status: 500 })
  })
}

describe('reconcilePayouts', () => {
  const originalApiKey = process.env.MOLLIE_API_KEY
  const originalMockPayouts = process.env.MOCK_PAYOUTS_ENABLED

  beforeEach(async () => {
    resetMockRouteStatus()
    await clearTestTables()
    process.env.MOLLIE_API_KEY = 'test_key'
    process.env.MOCK_PAYOUTS_ENABLED = 'true'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env.MOLLIE_API_KEY = originalApiKey
    process.env.MOCK_PAYOUTS_ENABLED = originalMockPayouts
  })

  it('does nothing when there are no payouts to check', async () => {
    const result = await reconcilePayouts()
    expect(result.checked).toBe(0)
    expect(result.reversed).toBe(0)
    expect(result.errors).toBe(0)
  })

  it('marks a sent payout as reversed when its route no longer exists', async () => {
    mockFetchRefunds([])
    await seedUser()
    await seedShop()
    const po = await createPlatformOrder('user-1')
    const so = await createShopOrder(po, 'shop-1', { status: 'delivered' })

    const [payoutRecord] = await db
      .insert(payout)
      .values({
        shopOrderId: so.id,
        shopId: 'shop-1',
        amountCents: 4500,
        status: 'sent',
        molliePaymentId: 'tr_test',
        mollieRouteId: 'crt_real_unknown',
        sentAt: new Date(),
      })
      .returning()

    const result = await reconcilePayouts()

    expect(result.checked).toBe(1)
    expect(result.reversed).toBe(1)
    expect(result.errors).toBe(0)

    const updated = await db.select().from(payout).where(eq(payout.id, payoutRecord.id)).limit(1)
    expect(updated[0]?.status).toBe('reversed')
    expect(updated[0]?.reversedAt).toBeInstanceOf(Date)

    const logs = await db
      .select()
      .from(payoutReconciliationLog)
      .where(eq(payoutReconciliationLog.payoutId, payoutRecord.id))
    expect(logs).toHaveLength(1)
    expect(logs[0]?.event).toBe('route_missing')
  })

  it('marks a sent payout as returned when Mollie reports the route as returned', async () => {
    setMockRouteStatus('returned')
    mockFetchRefunds([])
    await seedUser()
    await seedShop()
    const po = await createPlatformOrder('user-1')
    const so = await createShopOrder(po, 'shop-1', { status: 'delivered' })

    const [payoutRecord] = await db
      .insert(payout)
      .values({
        shopOrderId: so.id,
        shopId: 'shop-1',
        amountCents: 4500,
        status: 'sent',
        molliePaymentId: 'tr_test',
        mollieRouteId: 'crt_mock_1',
        sentAt: new Date(),
      })
      .returning()

    const result = await reconcilePayouts()

    expect(result.checked).toBe(1)
    expect(result.reversed).toBe(1)
    expect(result.errors).toBe(0)

    const updated = await db.select().from(payout).where(eq(payout.id, payoutRecord.id)).limit(1)
    expect(updated[0]?.status).toBe('returned')
    expect(updated[0]?.returnedAt).toBeInstanceOf(Date)
    expect(updated[0]?.returnReason).toBe('mollie_route_returned')

    const logs = await db
      .select()
      .from(payoutReconciliationLog)
      .where(eq(payoutReconciliationLog.payoutId, payoutRecord.id))
    expect(logs).toHaveLength(1)
    expect(logs[0]?.event).toBe('route_returned')
  })

  it('does not reverse a payout for an unrelated refund on the parent payment', async () => {
    // A refund larger than this shop order's total cannot be attributed to it,
    // so the payout should stay sent.
    mockFetchRefunds([{ id: 'refund_other', amount: { value: '50.00' }, status: 'refunded' }])
    await seedUser()
    await seedShop()
    const po = await createPlatformOrder('user-1')
    const so = await createShopOrder(po, 'shop-1', { status: 'delivered' })

    const [payoutRecord] = await db
      .insert(payout)
      .values({
        shopOrderId: so.id,
        shopId: 'shop-1',
        amountCents: 500,
        status: 'sent',
        molliePaymentId: 'tr_test',
        mollieRouteId: 'crt_mock_1',
        sentAt: new Date(),
      })
      .returning()

    const result = await reconcilePayouts()

    expect(result.checked).toBe(1)
    expect(result.reversed).toBe(0)
    expect(result.errors).toBe(0)

    const updated = await db.select().from(payout).where(eq(payout.id, payoutRecord.id)).limit(1)
    expect(updated[0]?.status).toBe('sent')
  })

  it('reverses a payout when the shop-order refund total covers the payout amount', async () => {
    mockFetchRefunds([{ id: 'refund_full', amount: { value: '25.00' }, status: 'refunded' }])
    await seedUser()
    await seedShop()
    const po = await createPlatformOrder('user-1')
    const so = await createShopOrder(po, 'shop-1', { status: 'delivered' })

    const [payoutRecord] = await db
      .insert(payout)
      .values({
        shopOrderId: so.id,
        shopId: 'shop-1',
        amountCents: 2000,
        status: 'sent',
        molliePaymentId: 'tr_test',
        mollieRouteId: 'crt_mock_1',
        sentAt: new Date(),
      })
      .returning()

    const result = await reconcilePayouts()

    expect(result.checked).toBe(1)
    expect(result.reversed).toBe(1)
    expect(result.errors).toBe(0)

    const updated = await db.select().from(payout).where(eq(payout.id, payoutRecord.id)).limit(1)
    expect(updated[0]?.status).toBe('reversed')
    expect(updated[0]?.reversalReason).toBe('refund_detected')
  })

  it('counts a refund-list API error as a reconciliation error', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ error: 'service unavailable' }), { status: 503 })
    })
    await seedUser()
    await seedShop()
    const po = await createPlatformOrder('user-1')
    const so = await createShopOrder(po, 'shop-1', { status: 'delivered' })

    await db.insert(payout).values({
      shopOrderId: so.id,
      shopId: 'shop-1',
      amountCents: 4500,
      status: 'sent',
      molliePaymentId: 'tr_test',
      mollieRouteId: 'crt_mock_1',
      sentAt: new Date(),
    })

    const result = await reconcilePayouts()

    expect(result.checked).toBe(1)
    expect(result.reversed).toBe(0)
    expect(result.errors).toBe(1)
  })
})
