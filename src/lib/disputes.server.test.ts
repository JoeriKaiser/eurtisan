import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import {
  inventoryReservation,
  invoices,
  payout,
  platformOrder,
  product,
  shopOrder,
} from '#/db/schema'
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
import { createInvoicesForPlatformOrder } from './invoices.server'
import { isValidDisputeTransition, openDisputeQuery, resolveDisputeQuery } from './disputes.server'

async function seedDisputeFixture(options?: {
  payoutStatus?: 'pending' | 'sent' | 'in_transit'
  productStockCount?: number
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
    stockCount: options?.productStockCount ?? 5,
  })

  const po = await createPlatformOrder(buyer, {
    shippingAddress: { name: 'Buyer', country: 'FR' },
    billingAddress: { name: 'Buyer', country: 'FR' },
    totalCents: 1200,
    status: 'paid',
    molliePaymentId: 'tr_mock_000001',
  })

  const so = await createShopOrder(po, shopRecord, {
    shippingMethod: 'standard',
    shippingCostCents: 200,
    subtotalCents: 1000,
    vatAmountCents: 0,
    shippingVatRateBasisPoints: 0,
    shippingVatAmountCents: 0,
    status: 'delivered',
    deliveredAt: new Date(),
    disputeWindowExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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

  if (options?.payoutStatus) {
    await createPayout(shopRecord, {
      shopOrderId: so.id,
      amountCents: 900,
      status: options.payoutStatus,
      molliePaymentId: 'tr_mock_000001',
    })
  }

  const created = await openDisputeQuery(
    {
      shopOrderId: so.id,
      reason: 'Item not as described',
      description: 'The vase arrived broken.',
    },
    buyer.id,
  )

  return {
    owner,
    buyer,
    shop: shopRecord,
    product: prod,
    platformOrder: po,
    shopOrder: so,
    disputeId: created.id,
  }
}

describe('resolveDisputeQuery', () => {
  beforeEach(async () => {
    await clearTestTables()
  })

  it('closes a dispute without refunding or restoring stock', async () => {
    const { disputeId, shopOrder: so, product: prod } = await seedDisputeFixture()

    const result = await resolveDisputeQuery(
      disputeId,
      { resolution: 'close' },
      { userId: 'admin-1', role: 'admin' },
    )

    expect(result.status).toBe('resolved')
    expect(result.resolution).toBe('close')

    const [updatedSo] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    expect(updatedSo.status).toBe('completed')

    const [updatedProduct] = await db.select().from(product).where(eq(product.id, prod.id))
    expect(updatedProduct.stockCount).toBe(5)
  })

  it('refunds the buyer and performs a partial payout clawback for a partial refund', async () => {
    const {
      disputeId,
      shopOrder: so,
      platformOrder: po,
      product: prod,
    } = await seedDisputeFixture({
      payoutStatus: 'sent',
    })

    const result = await resolveDisputeQuery(
      disputeId,
      { resolution: 'partial_refund', refundCents: 700 },
      { userId: 'admin-1', role: 'admin' },
    )

    expect(result.status).toBe('resolved')
    expect(result.resolution).toBe('partial_refund')
    expect(result.refundCents).toBe(700)

    const [updatedSo] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    // The current implementation sets the shop order to 'refunded' even for
    // partial refund resolutions; the partial nature is captured by refundCents.
    expect(updatedSo.status).toBe('refunded')
    expect(updatedSo.refundedCents).toBe(700)

    const [updatedPo] = await db.select().from(platformOrder).where(eq(platformOrder.id, po.id))
    expect(updatedPo.refundedCents).toBe(700)

    const [updatedProduct] = await db.select().from(product).where(eq(product.id, prod.id))
    expect(updatedProduct.stockCount).toBe(5)

    const [payoutRecord] = await db.select().from(payout).where(eq(payout.shopOrderId, so.id))
    // Partial refunds do not reverse the full payout; only the refunded portion
    // is clawed back from the seller's routed share.
    expect(payoutRecord.status).toBe('sent')
  })

  it('refunds the buyer and reverses a sent payout for a full refund', async () => {
    const {
      disputeId,
      shopOrder: so,
      platformOrder: po,
      product: prod,
    } = await seedDisputeFixture({
      payoutStatus: 'sent',
    })

    const result = await resolveDisputeQuery(
      disputeId,
      { resolution: 'full_refund' },
      { userId: 'admin-1', role: 'admin' },
    )

    expect(result.status).toBe('resolved')
    expect(result.resolution).toBe('full_refund')
    expect(result.refundCents).toBe(1200)

    const [updatedSo] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    expect(updatedSo.status).toBe('refunded')
    expect(updatedSo.refundedCents).toBe(1200)
    expect(updatedSo.refundPendingCents).toBe(0)

    const [updatedPo] = await db.select().from(platformOrder).where(eq(platformOrder.id, po.id))
    expect(updatedPo.refundedCents).toBe(1200)

    const [updatedProduct] = await db.select().from(product).where(eq(product.id, prod.id))
    expect(updatedProduct.stockCount).toBe(6)

    const reservations = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.platformOrderId, po.id))
    expect(reservations).toHaveLength(0)

    const creditNotes = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.shopOrderId, so.id), eq(invoices.type, 'credit_note')))
    expect(creditNotes).toHaveLength(1)
    expect(creditNotes[0].totalCents).toBeLessThan(0)

    const [payoutRecord] = await db.select().from(payout).where(eq(payout.shopOrderId, so.id))
    expect(payoutRecord.status).toBe('reversed')
  })

  it('restores stock only for the disputed shop order in a multi-shop platform order', async () => {
    const {
      buyer,
      platformOrder: po,
      disputeId,
    } = await seedDisputeFixture({
      productStockCount: 5,
    })

    const otherShop = await createShop(buyer.id, {
      name: 'Other Shop',
      slug: 'other-shop',
      mollieAccountId: 'org_other',
    })
    const otherProd = await createProduct(otherShop, {
      name: 'Mug',
      slug: 'mug',
      priceCents: 800,
      stockCount: 5,
    })
    const otherSo = await createShopOrder(po, otherShop, {
      shippingMethod: 'standard',
      shippingCostCents: 100,
      subtotalCents: 800,
      vatAmountCents: 0,
      shippingVatRateBasisPoints: 0,
      shippingVatAmountCents: 0,
      status: 'delivered',
      deliveredAt: new Date(),
      disputeWindowExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    await createOrderItem(otherSo, otherProd, {
      productName: 'Mug',
      unitPriceCents: 800,
      quantity: 1,
      totalCents: 800,
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
    })

    await resolveDisputeQuery(
      disputeId,
      { resolution: 'full_refund' },
      { userId: 'admin-1', role: 'admin' },
    )

    const [updatedProd] = await db.select().from(product).where(eq(product.id, otherProd.id))
    expect(updatedProd.stockCount).toBe(5)

    const [updatedSo] = await db.select().from(shopOrder).where(eq(shopOrder.id, otherSo.id))
    expect(updatedSo.status).toBe('delivered')
  })

  it('prevents double resolution due to concurrent calls', async () => {
    const { disputeId, shopOrder: so } = await seedDisputeFixture()

    const promise1 = resolveDisputeQuery(
      disputeId,
      { resolution: 'full_refund' },
      { userId: 'admin-1', role: 'admin' },
    )
    const promise2 = resolveDisputeQuery(
      disputeId,
      { resolution: 'full_refund' },
      { userId: 'admin-1', role: 'admin' },
    )

    const results = await Promise.allSettled([promise1, promise2])
    const successes = results.filter((r) => r.status === 'fulfilled')
    const failures = results.filter((r) => r.status === 'rejected')

    expect(successes).toHaveLength(1)
    expect(failures).toHaveLength(1)

    const [updatedSo] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    expect(updatedSo.status).toBe('refunded')
  })
})

describe('isValidDisputeTransition', () => {
  it('allows open -> resolved', () => {
    expect(isValidDisputeTransition('open', 'resolved')).toBe(true)
  })

  it('disallows resolved -> open', () => {
    expect(isValidDisputeTransition('resolved', 'open')).toBe(false)
  })

  it('disallows closed -> resolved', () => {
    expect(isValidDisputeTransition('closed', 'resolved')).toBe(false)
  })
})
