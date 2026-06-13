import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import { payout, payoutReconciliationLog, platformOrder, shop, shopOrder, user } from '#/db/schema'
import { eq } from 'drizzle-orm'
import { reconcilePayouts } from './payout-reconciliation.server'

async function seedUser() {
  return db
    .insert(user)
    .values({
      id: 'user-1',
      name: 'Test Creator',
      email: 'creator@example.com',
      emailVerified: true,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedShop() {
  return db
    .insert(shop)
    .values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: 'user-1',
      mollieAccountId: 'org_test',
      paymentConnected: true,
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedPlatformOrder() {
  return db
    .insert(platformOrder)
    .values({
      userId: 'user-1',
      shippingAddress: {
        name: 'Buyer',
        street: 'St',
        city: 'City',
        postalCode: '12345',
        country: 'DE',
      },
      billingAddress: {
        name: 'Buyer',
        street: 'St',
        city: 'City',
        postalCode: '12345',
        country: 'DE',
      },
      totalCents: 10000,
      status: 'paid',
      molliePaymentId: 'tr_test',
    })
    .returning()
    .then((rows) => rows[0])
}

async function seedShopOrder(overrides: Partial<typeof shopOrder.$inferInsert> = {}) {
  return db
    .insert(shopOrder)
    .values({
      platformOrderId: '00000000-0000-0000-0000-000000000000',
      shopId: 'shop-1',
      shippingMethod: 'standard',
      shippingCostCents: 500,
      subtotalCents: 5000,
      status: 'delivered',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

describe('reconcilePayouts', () => {
  beforeEach(async () => {
    await db.delete(payoutReconciliationLog)
    await db.delete(payout)
    await db.delete(shopOrder)
    await db.delete(platformOrder)
    await db.delete(shop)
    await db.delete(user)
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
    const po = await seedPlatformOrder()
    const so = await seedShopOrder({ platformOrderId: po.id })

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
})
