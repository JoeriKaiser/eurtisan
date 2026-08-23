import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '#/db/index'
import {
  financialTotalAudit,
  invoices,
  orderItem,
  payout,
  platformOrder,
  shopOrder,
} from '#/db/schema'
import {
  createPlatformOrder,
  createProduct,
  createShop,
  createShopOrder,
  createUser,
} from '#/test/factories'
import {
  recalcOrderItemTotal,
  recalcPlatformOrderTotal,
  recalcPlatformOrderTree,
  recalcShopOrderSubtotal,
  reconcileFinancialTotals,
  recordFinancialDiscrepancy,
  type FinancialMismatchCategory,
} from './financial-totals.server'

async function createBalancedFixture() {
  const buyer = await createUser()
  const owner = await createUser()
  const shop = await createShop(owner)
  const product = await createProduct(shop, { priceCents: 1000 })
  const po = await createPlatformOrder(buyer.id, { totalCents: 1200, refundedCents: 0 })
  const so = await createShopOrder(po, shop, {
    status: 'delivered',
    subtotalCents: 1000,
    shippingCostCents: 200,
    vatAmountCents: 167,
    shippingVatAmountCents: 33,
    refundedCents: 0,
    refundPendingCents: 0,
  })
  const [item] = await db
    .insert(orderItem)
    .values({
      shopOrderId: so.id,
      productId: product.id,
      productName: product.name,
      unitPriceCents: 1000,
      quantity: 1,
      vatRateBasisPoints: 2000,
      vatAmountCents: 167,
      totalCents: 1000,
    })
    .returning()
  const [customerInvoice] = await db
    .insert(invoices)
    .values({
      invoiceNumber: `INV-${po.id}`,
      type: 'customer',
      shopOrderId: so.id,
      subtotalCents: 1000,
      vatAmountCents: 200,
      totalCents: 1200,
      billingDetails: {},
    })
    .returning()
  const [feeInvoice] = await db
    .insert(invoices)
    .values({
      invoiceNumber: `INV-FEE-${po.id}`,
      type: 'platform_fee',
      shopOrderId: so.id,
      subtotalCents: 83,
      vatAmountCents: 0,
      totalCents: 83,
      billingDetails: {},
    })
    .returning()
  const [payoutRow] = await db
    .insert(payout)
    .values({
      shopOrderId: so.id,
      shopId: shop.id,
      amountCents: 917,
      status: 'pending',
    })
    .returning()

  return { po, so, item, customerInvoice, feeInvoice, payout: payoutRow, product, shop }
}

function detectedCategories(result: Awaited<ReturnType<typeof reconcileFinancialTotals>>) {
  return new Set(
    Object.entries(result.mismatchCounts)
      .filter(([, count]) => count > 0)
      .map(([category]) => category as FinancialMismatchCategory),
  )
}

describe('financial-totals.server', () => {
  beforeEach(async () => {
    await db.delete(financialTotalAudit)
    await db.delete(orderItem)
    await db.delete(shopOrder)
    await db.delete(platformOrder)
  })

  describe('checkout-owned recalculation', () => {
    it('computes order-item total and VAT', async () => {
      const buyer = await createUser()
      const owner = await createUser()
      const shop = await createShop(owner)
      const product = await createProduct(shop)
      const po = await createPlatformOrder(buyer.id)
      const so = await createShopOrder(po, shop)
      const [item] = await db
        .insert(orderItem)
        .values({
          shopOrderId: so.id,
          productId: product.id,
          productName: product.name,
          unitPriceCents: 1000,
          quantity: 3,
          vatRateBasisPoints: 2100,
          vatAmountCents: 0,
          totalCents: 0,
        })
        .returning()

      const result = await db.transaction(async (tx) => recalcOrderItemTotal(tx, item.id))
      expect(result).toEqual({ totalCents: 3000, vatAmountCents: 521 })
    })

    it('sums order-item gross totals and VAT into the shop order', async () => {
      const fixture = await createBalancedFixture()
      await db
        .update(shopOrder)
        .set({ subtotalCents: 0, vatAmountCents: 0 })
        .where(eq(shopOrder.id, fixture.so.id))

      const result = await db.transaction(async (tx) => recalcShopOrderSubtotal(tx, fixture.so.id))
      expect(result).toEqual({ subtotalCents: 1000, vatAmountCents: 167 })
    })

    it('does not add VAT twice when recomputing the platform order', async () => {
      const fixture = await createBalancedFixture()
      await db
        .update(platformOrder)
        .set({ totalCents: 0 })
        .where(eq(platformOrder.id, fixture.po.id))

      const result = await db.transaction(async (tx) => recalcPlatformOrderTotal(tx, fixture.po.id))
      expect(result).toBe(1200)
    })

    it('recalculates the complete checkout tree consistently', async () => {
      const fixture = await createBalancedFixture()
      await db.update(orderItem).set({ totalCents: 0, vatAmountCents: 0 })
      await db.update(shopOrder).set({ subtotalCents: 0, vatAmountCents: 0 })
      await db.update(platformOrder).set({ totalCents: 0 })

      await db.transaction(async (tx) => recalcPlatformOrderTree(tx, fixture.po.id))

      const [updatedOrder] = await db
        .select()
        .from(platformOrder)
        .where(eq(platformOrder.id, fixture.po.id))
      expect(updatedOrder.totalCents).toBe(1200)
    })
  })

  describe('read-only reconciliation', () => {
    it('reports balanced financial data without writing audit or financial rows', async () => {
      const fixture = await createBalancedFixture()
      const before = await db.select().from(shopOrder).where(eq(shopOrder.id, fixture.so.id))

      const result = await reconcileFinancialTotals({ batchSize: 1 })

      expect(result.mismatches).toBe(0)
      expect(result.recordsChecked).toEqual({
        order_item: 1,
        shop_order: 1,
        platform_order: 1,
        invoice: 2,
        payout: 1,
      })
      expect(await db.select().from(financialTotalAudit)).toHaveLength(0)
      const after = await db.select().from(shopOrder).where(eq(shopOrder.id, fixture.so.id))
      expect(after).toEqual(before)
    })

    it.each<{
      category: FinancialMismatchCategory
      mutate: (fixture: Awaited<ReturnType<typeof createBalancedFixture>>) => Promise<unknown>
    }>([
      {
        category: 'order_item_total',
        mutate: ({ item }) =>
          db.update(orderItem).set({ totalCents: 999 }).where(eq(orderItem.id, item.id)),
      },
      {
        category: 'order_item_vat',
        mutate: ({ item }) =>
          db.update(orderItem).set({ vatAmountCents: 199 }).where(eq(orderItem.id, item.id)),
      },
      {
        category: 'shop_order_subtotal',
        mutate: ({ so }) =>
          db.update(shopOrder).set({ subtotalCents: 999 }).where(eq(shopOrder.id, so.id)),
      },
      {
        category: 'shop_order_vat',
        mutate: ({ so }) =>
          db.update(shopOrder).set({ vatAmountCents: 199 }).where(eq(shopOrder.id, so.id)),
      },
      {
        category: 'shop_order_refund',
        mutate: ({ so }) =>
          db.update(shopOrder).set({ refundPendingCents: 1201 }).where(eq(shopOrder.id, so.id)),
      },
      {
        category: 'platform_order_total',
        mutate: ({ po }) =>
          db.update(platformOrder).set({ totalCents: 1199 }).where(eq(platformOrder.id, po.id)),
      },
      {
        category: 'platform_order_refund',
        mutate: ({ po }) =>
          db.update(platformOrder).set({ refundedCents: 1 }).where(eq(platformOrder.id, po.id)),
      },
      {
        category: 'invoice_total',
        mutate: ({ customerInvoice }) =>
          db
            .update(invoices)
            .set({ subtotalCents: 959 })
            .where(eq(invoices.id, customerInvoice.id)),
      },
      {
        category: 'customer_invoice_order',
        mutate: ({ customerInvoice }) =>
          db
            .update(invoices)
            .set({ subtotalCents: 959, totalCents: 1199 })
            .where(eq(invoices.id, customerInvoice.id)),
      },
      {
        category: 'platform_fee_invoice',
        mutate: ({ feeInvoice }) =>
          db
            .update(invoices)
            .set({ subtotalCents: 79, totalCents: 79 })
            .where(eq(invoices.id, feeInvoice.id)),
      },
      {
        category: 'credit_note_refund',
        mutate: async ({ po, so }) => {
          await db.update(shopOrder).set({ refundedCents: 100 }).where(eq(shopOrder.id, so.id))
          return db
            .update(platformOrder)
            .set({ refundedCents: 100 })
            .where(eq(platformOrder.id, po.id))
        },
      },
      {
        category: 'financial_state_incomplete',
        mutate: ({ feeInvoice }) => db.delete(invoices).where(eq(invoices.id, feeInvoice.id)),
      },
      {
        category: 'payout_amount',
        mutate: ({ payout: payoutRow }) =>
          db.update(payout).set({ amountCents: 919 }).where(eq(payout.id, payoutRow.id)),
      },
      {
        category: 'payout_invoice_disagreement',
        mutate: ({ feeInvoice }) =>
          db
            .update(invoices)
            .set({ subtotalCents: 79, totalCents: 79 })
            .where(eq(invoices.id, feeInvoice.id)),
      },
      {
        category: 'provider_state_incomplete',
        mutate: ({ payout: payoutRow }) =>
          db.update(payout).set({ status: 'sent' }).where(eq(payout.id, payoutRow.id)),
      },
      {
        category: 'chargeback_payout',
        mutate: ({ so }) =>
          db.update(shopOrder).set({ status: 'chargeback' }).where(eq(shopOrder.id, so.id)),
      },
    ])('detects $category drift', async ({ category, mutate }) => {
      const fixture = await createBalancedFixture()
      await mutate(fixture)

      const result = await reconcileFinancialTotals()
      expect(detectedCategories(result)).toContain(category)
    })

    it('accepts matched partial refunds and full chargeback accounting', async () => {
      const fixture = await createBalancedFixture()
      await db.update(shopOrder).set({ status: 'chargeback', refundedCents: 1200 })
      await db.update(platformOrder).set({ status: 'chargeback', refundedCents: 1200 })
      await db.update(payout).set({ status: 'reversed', reversedAt: new Date() })
      await db.insert(invoices).values({
        invoiceNumber: `CN-${fixture.po.id}`,
        type: 'credit_note',
        shopOrderId: fixture.so.id,
        originalInvoiceNumber: fixture.customerInvoice.invoiceNumber,
        subtotalCents: -960,
        vatAmountCents: -240,
        totalCents: -1200,
        billingDetails: {},
      })

      const result = await reconcileFinancialTotals()
      expect(result.mismatchCounts.credit_note_refund).toBe(0)
      expect(result.mismatchCounts.chargeback_payout).toBe(0)
      expect(result.mismatchCounts.provider_state_incomplete).toBe(0)
    })

    it('uses a repeatable read snapshot during concurrent order changes', async () => {
      const fixture = await createBalancedFixture()
      await db.update(orderItem).set({ totalCents: 999 }).where(eq(orderItem.id, fixture.item.id))
      let changed = false

      const firstRun = await reconcileFinancialTotals({
        onMismatch: async () => {
          if (changed) return
          changed = true
          await db
            .update(platformOrder)
            .set({ totalCents: 9999 })
            .where(eq(platformOrder.id, fixture.po.id))
        },
      })
      expect(firstRun.mismatchCounts.platform_order_total).toBe(0)

      const secondRun = await reconcileFinancialTotals()
      expect(secondRun.mismatchCounts.platform_order_total).toBe(1)
    })

    it('processes a representative larger dataset in bounded batches', async () => {
      const fixture = await createBalancedFixture()
      await db.delete(orderItem).where(eq(orderItem.shopOrderId, fixture.so.id))
      const rows = Array.from({ length: 600 }, (_, index) => ({
        shopOrderId: fixture.so.id,
        productId: fixture.product.id,
        productName: `Batch item ${index}`,
        unitPriceCents: 100,
        quantity: 1,
        vatRateBasisPoints: 2000,
        vatAmountCents: 17,
        totalCents: 100,
      }))
      await db.insert(orderItem).values(rows)
      await db
        .update(shopOrder)
        .set({ subtotalCents: 60_000, vatAmountCents: 10_200, shippingCostCents: 0 })
        .where(eq(shopOrder.id, fixture.so.id))
      await db.update(platformOrder).set({ totalCents: 60_000 })
      await db
        .update(invoices)
        .set({ subtotalCents: 49_800, vatAmountCents: 10_200, totalCents: 60_000 })
        .where(eq(invoices.id, fixture.customerInvoice.id))
      await db
        .update(invoices)
        .set({ subtotalCents: 4_980, totalCents: 4_980 })
        .where(eq(invoices.id, fixture.feeInvoice.id))
      await db.update(payout).set({ amountCents: 55_020 })

      const result = await reconcileFinancialTotals({ batchSize: 100 })
      expect(result.recordsChecked.order_item).toBe(600)
      expect(result.mismatches).toBe(0)
    })
  })

  describe('explicit audit evidence writer', () => {
    it('is separate from routine detection', async () => {
      await db.transaction(async (tx) =>
        recordFinancialDiscrepancy(tx, {
          entityType: 'shop_order',
          entityId: 'so-test',
          fieldName: 'subtotalCents',
          storedCents: 100,
          computedCents: 200,
        }),
      )

      const rows = await db.select().from(financialTotalAudit)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.diffCents).toBe(100)
    })
  })
})
