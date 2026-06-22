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
  createInventoryReservation,
  createOrderItem,
  createPayout,
  createPlatformOrder,
  createProduct,
  createShop,
  createShopOrder,
  createUser,
} from '#/test/factories'
import { resetMockPaymentStatuses, setMockPaymentStatus } from '#/integrations/mollie'
import { flushBackgroundWorkForTests } from './background-work.server'
import { createInvoicesForPlatformOrder } from './invoices.server'
import {
  cancelShopOrderQuery,
  refundShopOrderQuery,
  resolveManualReviewQuery,
} from './shop-orders.server'

describe('refundShopOrderQuery', () => {
  beforeEach(async () => {
    await clearTestTables()
  })

  async function seedRefundFixture(options?: {
    payoutStatus?: 'pending' | 'sent' | 'in_transit'
    productStockCount?: number
    reservedQuantity?: number
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
      status: 'paid',
    })

    await createOrderItem(so, prod, {
      productName: 'Vase',
      unitPriceCents: 1000,
      quantity: 2,
      totalCents: 2000,
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
    })

    if (options?.reservedQuantity) {
      await createInventoryReservation(prod, {
        platformOrderId: po.id,
        quantity: options.reservedQuantity,
        expiresAt: new Date(Date.now() + 60_000),
      })
    }

    await createInvoicesForPlatformOrder(po.id)

    if (options?.payoutStatus) {
      await createPayout(shopRecord, {
        shopOrderId: so.id,
        amountCents: 900,
        status: options.payoutStatus,
        molliePaymentId: 'tr_test',
      })
    }

    return { owner, buyer, shop: shopRecord, product: prod, platformOrder: po, shopOrder: so }
  }

  it('refunds a paid shop order and creates a credit note', async () => {
    const {
      owner,
      product: prod,
      shopOrder: so,
      platformOrder: po,
    } = await seedRefundFixture({
      productStockCount: 3,
      reservedQuantity: 2,
    })

    const result = await refundShopOrderQuery(owner.id, so.id)

    expect(result.success).toBe(true)
    expect(result.shopOrderId).toBe(so.id)
    expect(result.creditNoteNumber).toMatch(/^CN-\d{4}-\d{5}$/)

    const [updatedSo] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    expect(updatedSo.status).toBe('refunded')
    expect(updatedSo.refundedCents).toBe(1200)

    const [updatedPo] = await db.select().from(platformOrder).where(eq(platformOrder.id, po.id))
    expect(updatedPo.refundedCents).toBe(1200)

    const [updatedProduct] = await db.select().from(product).where(eq(product.id, prod.id))
    expect(updatedProduct.stockCount).toBe(5)

    const reservation = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.platformOrderId, po.id))
    expect(reservation).toHaveLength(0)

    const creditNote = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, result.creditNoteNumber ?? ''))
    expect(creditNote).toHaveLength(1)
    expect(creditNote[0].type).toBe('credit_note')
    expect(creditNote[0].totalCents).toBeLessThan(0)

    await flushBackgroundWorkForTests()
  })

  it('reverses an already sent payout during refund', async () => {
    const { owner, shopOrder: so } = await seedRefundFixture({ payoutStatus: 'sent' })

    await refundShopOrderQuery(owner.id, so.id)

    const [payoutRecord] = await db.select().from(payout).where(eq(payout.shopOrderId, so.id))
    expect(payoutRecord.status).toBe('reversed')
    expect(payoutRecord.reversalReason).toBe('owner_refund')
  })

  it('throws 404 when the caller does not own the shop', async () => {
    const { shopOrder: so } = await seedRefundFixture()

    await expect(refundShopOrderQuery('stranger-id', so.id)).rejects.toThrow()
  })

  it('throws 409 when the shop order is already refunded', async () => {
    const { owner, shopOrder: so } = await seedRefundFixture()
    await db.update(shopOrder).set({ status: 'refunded' }).where(eq(shopOrder.id, so.id))

    await expect(refundShopOrderQuery(owner.id, so.id)).rejects.toThrow()
  })

  it('throws when the parent payment is not available', async () => {
    const { owner, platformOrder: po, shopOrder: so } = await seedRefundFixture()
    await db.update(platformOrder).set({ molliePaymentId: null }).where(eq(platformOrder.id, po.id))

    await expect(refundShopOrderQuery(owner.id, so.id)).rejects.toThrow()
  })

  it('records a refund intent and leaves the order in refund_pending when Mollie fails', async () => {
    const {
      owner,
      shopOrder: so,
      platformOrder: po,
    } = await seedRefundFixture({
      payoutStatus: 'sent',
    })
    await db
      .update(platformOrder)
      .set({ molliePaymentId: 'bad' })
      .where(eq(platformOrder.id, po.id))

    await expect(refundShopOrderQuery(owner.id, so.id)).rejects.toMatchObject({ status: 502 })

    const [updatedSo] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    expect(updatedSo.status).toBe('paid')
    expect(updatedSo.refundPendingCents).toBe(1200)

    const [payoutRecord] = await db.select().from(payout).where(eq(payout.shopOrderId, so.id))
    expect(payoutRecord.status).toBe('reversed')

    const creditNotes = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.shopOrderId, so.id), eq(invoices.type, 'credit_note')))
    expect(creditNotes).toHaveLength(1)
  })
})

describe('cancelShopOrderQuery', () => {
  beforeEach(async () => {
    await clearTestTables()
    resetMockPaymentStatuses()
  })

  async function seedPendingPaymentFixture(options?: { withSentPayout?: boolean }) {
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
      status: 'pending_payment',
      molliePaymentId: 'tr_mock_000001',
    })

    const so = await createShopOrder(po, shopRecord, {
      shippingMethod: 'standard',
      shippingCostCents: 200,
      subtotalCents: 1000,
      vatAmountCents: 0,
      shippingVatRateBasisPoints: 0,
      shippingVatAmountCents: 0,
      status: 'pending_payment',
    })

    await createOrderItem(so, prod, {
      productName: 'Vase',
      unitPriceCents: 1000,
      quantity: 1,
      totalCents: 1000,
      vatRateBasisPoints: 0,
      vatAmountCents: 0,
    })

    await createInventoryReservation(prod, {
      platformOrderId: po.id,
      quantity: 1,
      expiresAt: new Date(Date.now() + 60_000),
    })

    if (options?.withSentPayout) {
      await createPayout(shopRecord, {
        shopOrderId: so.id,
        amountCents: 900,
        status: 'sent',
        molliePaymentId: 'tr_mock_000001',
      })
    }

    return { owner, buyer, shop: shopRecord, product: prod, platformOrder: po, shopOrder: so }
  }

  it('cancels a pending_payment order and releases the held stock', async () => {
    setMockPaymentStatus('tr_mock_000001', 'pending')
    const { product: prod, platformOrder: po, shopOrder: so } = await seedPendingPaymentFixture()

    await cancelShopOrderQuery(so.id, { reason: 'Buyer requested cancellation' })

    const [updatedSo] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    expect(updatedSo.status).toBe('cancelled')

    const [updatedPo] = await db.select().from(platformOrder).where(eq(platformOrder.id, po.id))
    expect(updatedPo.status).toBe('cancelled')

    const [updatedProduct] = await db.select().from(product).where(eq(product.id, prod.id))
    expect(updatedProduct.stockCount).toBe(4)

    const reservations = await db
      .select()
      .from(inventoryReservation)
      .where(eq(inventoryReservation.platformOrderId, po.id))
    expect(reservations).toHaveLength(0)
  })

  it('refunds the buyer when a pending_payment order was already captured', async () => {
    // Default mock status is 'paid', so cancelPayment will throw "already captured".
    const {
      product: prod,
      platformOrder: po,
      shopOrder: so,
    } = await seedPendingPaymentFixture({
      withSentPayout: true,
    })

    await cancelShopOrderQuery(so.id)

    const [updatedSo] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    expect(updatedSo.status).toBe('refunded')
    expect(updatedSo.refundedCents).toBe(1200)

    const [updatedPo] = await db.select().from(platformOrder).where(eq(platformOrder.id, po.id))
    expect(updatedPo.refundedCents).toBe(1200)

    const [updatedProduct] = await db.select().from(product).where(eq(product.id, prod.id))
    expect(updatedProduct.stockCount).toBe(4)

    const creditNotes = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.shopOrderId, so.id), eq(invoices.type, 'credit_note')))
    expect(creditNotes).toHaveLength(1)
    expect(creditNotes[0].totalCents).toBeLessThan(0)

    const [payoutRecord] = await db.select().from(payout).where(eq(payout.shopOrderId, so.id))
    expect(payoutRecord.status).toBe('reversed')
  })
})

describe('resolveManualReviewQuery', () => {
  beforeEach(async () => {
    await clearTestTables()
    resetMockPaymentStatuses()
  })

  async function seedManualReviewFixture() {
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
      status: 'manual_review',
      molliePaymentId: 'tr_mock_000001',
    })

    const so = await createShopOrder(po, shopRecord, {
      shippingMethod: 'standard',
      shippingCostCents: 200,
      subtotalCents: 1000,
      vatAmountCents: 0,
      shippingVatRateBasisPoints: 0,
      shippingVatAmountCents: 0,
      status: 'manual_review',
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

    return { owner, buyer, shop: shopRecord, product: prod, platformOrder: po, shopOrder: so }
  }

  it('refunds the buyer before cancelling a manual-review order', async () => {
    const { product: prod, platformOrder: po, shopOrder: so } = await seedManualReviewFixture()

    await resolveManualReviewQuery(so.id, { resolution: 'cancelled', reason: 'Fraud check failed' })

    const [updatedSo] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    expect(updatedSo.status).toBe('cancelled')
    expect(updatedSo.refundedCents).toBe(1200)

    const [updatedPo] = await db.select().from(platformOrder).where(eq(platformOrder.id, po.id))
    expect(updatedPo.refundedCents).toBe(1200)

    const [updatedProduct] = await db.select().from(product).where(eq(product.id, prod.id))
    expect(updatedProduct.stockCount).toBe(4)

    const creditNotes = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.shopOrderId, so.id), eq(invoices.type, 'credit_note')))
    expect(creditNotes).toHaveLength(1)
    expect(creditNotes[0].totalCents).toBeLessThan(0)
  })

  it('aborts cancellation when the Mollie refund fails', async () => {
    const { product: prod, platformOrder: po, shopOrder: so } = await seedManualReviewFixture()
    await db
      .update(platformOrder)
      .set({ molliePaymentId: 'bad' })
      .where(eq(platformOrder.id, po.id))

    await expect(
      resolveManualReviewQuery(so.id, { resolution: 'cancelled', reason: 'Fraud check failed' }),
    ).rejects.toMatchObject({ status: 502 })

    const [updatedSo] = await db.select().from(shopOrder).where(eq(shopOrder.id, so.id))
    expect(updatedSo.status).toBe('manual_review')
    expect(updatedSo.refundedCents).toBe(0)

    const [updatedProduct] = await db.select().from(product).where(eq(product.id, prod.id))
    expect(updatedProduct.stockCount).toBe(3)

    const creditNotes = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.shopOrderId, so.id), eq(invoices.type, 'credit_note')))
    expect(creditNotes).toHaveLength(0)
  })
})
