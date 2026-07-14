import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import { platformOrder, shopOrder } from '#/db/schema'
import type { PaymentProvider } from '#/lib/payment-provider'
import { clearTestTables } from '#/test/cleanup'
import { createPlatformOrder, createShop, createShopOrder, createUser } from '#/test/factories'
import { reconcilePendingMolliePayments } from './mollie-reconciliation.server'

function paymentProvider(overrides?: Partial<PaymentProvider>): PaymentProvider {
  return {
    createPayment: async () => ({
      paymentId: 'tr_reconcile_001',
      checkoutUrl: 'https://checkout.mollie.com/pay/tr_reconcile_001',
    }),
    getPaymentStatus: async () => 'paid',
    getPaymentAmount: async () => 1000,
    refundPayment: async () => undefined,
    cancelPayment: async () => undefined,
    ...overrides,
  }
}

async function seedPendingPayment(updatedAt: Date) {
  const buyer = await createUser({
    name: 'Buyer',
    email: 'buyer-reconciliation@example.com',
  })
  const creator = await createUser({
    name: 'Creator',
    email: 'creator-reconciliation@example.com',
    role: 'creator',
    twoFactorEnabled: true,
  })
  const shop = await createShop(creator, {
    name: 'Reconciliation Shop',
    slug: 'reconciliation-shop',
  })
  const order = await createPlatformOrder(buyer, {
    status: 'pending_payment',
    totalCents: 1000,
    molliePaymentId: 'tr_reconcile_001',
    updatedAt,
  })
  await createShopOrder(order, shop, {
    status: 'pending_payment',
    subtotalCents: 1000,
    shippingCostCents: 0,
    processingTimeMaxBusinessDays: 3,
    transitTimeMinBusinessDays: 2,
    transitTimeMaxBusinessDays: 5,
  })
  return order
}

describe('reconcilePendingMolliePayments', () => {
  beforeEach(async () => {
    await clearTestTables()
  })

  it('recovers a paid order when its classic webhook was missed', async () => {
    const now = new Date('2026-07-13T12:00:00.000Z')
    const order = await seedPendingPayment(new Date('2026-07-13T11:55:00.000Z'))

    const result = await reconcilePendingMolliePayments({
      db,
      paymentProvider: paymentProvider(),
      minAgeMs: 60_000,
      batchSize: 10,
      now,
    })

    expect(result).toMatchObject({ checked: 1, processed: 1, errors: 0 })
    const [updated] = await db
      .select({ status: platformOrder.status, paidAt: platformOrder.paidAt })
      .from(platformOrder)
      .where(eq(platformOrder.id, order.id))
    expect(updated.status).toBe('paid')
    expect(updated.paidAt).toBeInstanceOf(Date)

    const [promises] = await db
      .select({
        fulfillmentDueAt: shopOrder.fulfillmentDueAt,
        earliestDeliveryAt: shopOrder.earliestDeliveryAt,
        deliveryDueAt: shopOrder.deliveryDueAt,
      })
      .from(shopOrder)
      .where(eq(shopOrder.platformOrderId, order.id))
    expect(promises.fulfillmentDueAt).toBeInstanceOf(Date)
    expect(promises.earliestDeliveryAt?.getTime()).toBeGreaterThan(
      promises.fulfillmentDueAt?.getTime() ?? 0,
    )
    expect(promises.deliveryDueAt?.getTime()).toBeGreaterThan(
      promises.earliestDeliveryAt?.getTime() ?? 0,
    )
  })

  it('does not race a recent payment that is still inside the webhook grace period', async () => {
    const now = new Date('2026-07-13T12:00:00.000Z')
    const order = await seedPendingPayment(new Date('2026-07-13T11:59:30.000Z'))

    const result = await reconcilePendingMolliePayments({
      db,
      paymentProvider: paymentProvider(),
      minAgeMs: 60_000,
      batchSize: 10,
      now,
    })

    expect(result.checked).toBe(0)
    const [unchanged] = await db
      .select({ status: platformOrder.status })
      .from(platformOrder)
      .where(eq(platformOrder.id, order.id))
    expect(unchanged.status).toBe('pending_payment')
  })

  it('records a provider failure and leaves the order pending for retry', async () => {
    const now = new Date('2026-07-13T12:00:00.000Z')
    const order = await seedPendingPayment(new Date('2026-07-13T11:55:00.000Z'))

    const result = await reconcilePendingMolliePayments({
      db,
      paymentProvider: paymentProvider({
        getPaymentStatus: async () => {
          throw new Error('Mollie unavailable')
        },
      }),
      minAgeMs: 60_000,
      batchSize: 10,
      now,
    })

    expect(result).toMatchObject({ checked: 1, processed: 0, errors: 1 })
    const [unchanged] = await db
      .select({ status: platformOrder.status })
      .from(platformOrder)
      .where(eq(platformOrder.id, order.id))
    expect(unchanged.status).toBe('pending_payment')
  })
})
