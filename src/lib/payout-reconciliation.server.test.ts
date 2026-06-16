import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
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

describe('reconcilePayouts', () => {
  beforeEach(async () => {
    resetMockRouteStatus()
    await clearTestTables()
  })

  it('does nothing when there are no payouts to check', async () => {
    const result = await reconcilePayouts()
    expect(result.checked).toBe(0)
    expect(result.reversed).toBe(0)
    expect(result.errors).toBe(0)
  })

  it('marks a sent payout as reversed when its route no longer exists', async () => {
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
})
