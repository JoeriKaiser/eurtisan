import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import { invoices, payout, platformOrder, product, shopOrder } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import {
  createOrderItem,
  createPayout,
  createPlatformOrder,
  createProduct,
  createShop,
  createShopOrder,
  createUser,
} from '#/test/factories'
import { flushBackgroundWorkForTests } from '../background-work.server'
import { createInvoicesForPlatformOrder } from '../invoices.server'
import { handleChargeback } from './chargebacks.server'

describe('handleChargeback', () => {
  beforeEach(async () => {
    await clearTestTables()
  })

  async function seedChargebackFixture(options?: {
    platformStatus?: typeof platformOrder.$inferSelect.status
  }) {
    const owner = await createUser({
      name: 'Owner',
      email: 'owner@example.com',
      role: 'creator',
      emailVerified: true,
    })

    const buyer = await createUser({
      name: 'Buyer',
      email: 'buyer@example.com',
      role: 'customer',
    })

    const shopRecord = await createShop(owner, {
      name: 'Test Shop',
      slug: 'test-shop',
      mollieAccountId: 'org_test',
    })

    const prod = await createProduct(shopRecord, {
      name: 'Vase',
      slug: 'vase',
      priceCents: 1000,
      stockCount: 3,
    })

    const po = await createPlatformOrder(buyer, {
      shippingAddress: { name: 'Buyer', country: 'FR' },
      billingAddress: { name: 'Buyer', country: 'FR' },
      totalCents: 1200,
      status: options?.platformStatus ?? 'paid',
      molliePaymentId: 'tr_mock_000001',
    })

    const so = await createShopOrder(po, shopRecord, {
      shippingMethod: 'standard',
      shippingCostCents: 200,
      subtotalCents: 1000,
      vatAmountCents: 0,
      shippingVatRateBasisPoints: 0,
      shippingVatAmountCents: 0,
      status: 'paid',
    })

    await createOrderItem(so, prod, {
      productName: 'Vase',
      unitPriceCents: 1000,
      quantity: 1,
      totalCents: 1000,
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
    })

    await createInvoicesForPlatformOrder(po.id)

    await createPayout(shopRecord, {
      shopOrderId: so.id,
      amountCents: 900,
      status: 'sent',
      molliePaymentId: 'tr_mock_000001',
    })

    return { shopRecord, product: prod, platformOrder: po, shopOrder: so }
  }

  it('reverses the payout, issues a credit note, restores stock and marks the order chargeback', async () => {
    const { product: prod, platformOrder: po, shopOrder: so } = await seedChargebackFixture()

    const result = await handleChargeback('tr_mock_000001')

    expect(result.status).toBe('chargeback')

    const [updatedPo] = await db.select().from(platformOrder).where(eq(platformOrder.id, po.id))
    expect(updatedPo.status).toBe('chargeback')
    expect(updatedPo.refundedCents).toBe(1200)

    const [updatedSo] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    expect(updatedSo.status).toBe('chargeback')
    expect(updatedSo.refundedCents).toBe(1200)

    const [payoutRecord] = await db.select().from(payout).where(eq(payout.shopOrderId, so.id))
    expect(payoutRecord.status).toBe('reversed')

    const [updatedProduct] = await db.select().from(product).where(eq(product.id, prod.id))
    expect(updatedProduct.stockCount).toBe(4)

    const creditNotes = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.shopOrderId, so.id), eq(invoices.type, 'credit_note')))
    expect(creditNotes).toHaveLength(1)
    expect(creditNotes[0].totalCents).toBeLessThan(0)

    await flushBackgroundWorkForTests()
  })

  it('returns already_processed for an order already marked chargeback', async () => {
    await seedChargebackFixture({ platformStatus: 'chargeback' })

    const result = await handleChargeback('tr_mock_000001')

    expect(result.status).toBe('already_processed')
  })

  it('returns unknown_payment for a payment id not tied to any order', async () => {
    const result = await handleChargeback('tr_mock_does_not_exist')

    expect(result.status).toBe('unknown_payment')
  })

  it('is idempotent when called twice for the same payment', async () => {
    const { shopOrder: so } = await seedChargebackFixture()

    const first = await handleChargeback('tr_mock_000001')
    const second = await handleChargeback('tr_mock_000001')

    expect(first.status).toBe('chargeback')
    expect(second.status).toBe('already_processed')

    const creditNotes = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.shopOrderId, so.id), eq(invoices.type, 'credit_note')))
    expect(creditNotes).toHaveLength(1)

    await flushBackgroundWorkForTests()
  })
})
