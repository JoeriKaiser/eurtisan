import { asc, eq, gt, inArray, sum } from 'drizzle-orm'

import { db } from '#/db/index'
import {
  financialTotalAudit,
  invoices,
  orderItem,
  payout,
  platformOrder,
  shopOrder,
} from '#/db/schema'
import { PLATFORM_FEE_PERCENT } from '../platform-constants'

export type Transaction = Omit<typeof db, '$client'>

export const FINANCIAL_MISMATCH_CATEGORIES = [
  'order_item_total',
  'order_item_vat',
  'shop_order_subtotal',
  'shop_order_vat',
  'shop_order_refund',
  'platform_order_total',
  'platform_order_refund',
  'invoice_total',
  'customer_invoice_order',
  'platform_fee_invoice',
  'credit_note_refund',
  'financial_state_incomplete',
  'payout_amount',
  'payout_invoice_disagreement',
  'provider_state_incomplete',
  'chargeback_payout',
] as const

export type FinancialMismatchCategory = (typeof FINANCIAL_MISMATCH_CATEGORIES)[number]
export type FinancialEntityType =
  | 'order_item'
  | 'shop_order'
  | 'platform_order'
  | 'invoice'
  | 'payout'

export interface FinancialMismatch {
  category: FinancialMismatchCategory
  entityType: FinancialEntityType
  entityId: string
  fieldName: string
  storedCents: number | null
  computedCents: number | null
  differenceCents: number | null
}

export interface FinancialReconciliationResult {
  recordsChecked: Record<FinancialEntityType, number>
  mismatches: number
  mismatchCounts: Record<FinancialMismatchCategory, number>
}

export interface FinancialReconciliationOptions {
  batchSize?: number
  onMismatch?: (mismatch: FinancialMismatch) => void | Promise<void>
}

interface OrderItemRow {
  id: string
  unitPriceCents: number
  quantity: number
  vatRateBasisPoints: number
  vatAmountCents: number
  totalCents: number
}

const DEFAULT_BATCH_SIZE = 500

/**
 * Extract the VAT portion from a VAT-inclusive amount at the given rate.
 *
 * Prices are stored VAT-inclusive (see calculateVat in vat.server): recover the
 * exclusive base first, then take VAT as the remainder. Applying the rate on top
 * of an inclusive amount would overstate VAT. Parity with calculateVat is pinned
 * by the inclusive VAT extraction tests in financial-totals.server.test.ts.
 */
export function vatFromBasisPoints(amountCents: number, basisPoints: number): number {
  const baseAmountCents = Math.round((amountCents * 10000) / (10000 + basisPoints))
  return amountCents - baseAmountCents
}

function platformFeeCents(subtotalCents: number, vatAmountCents: number): number {
  return Math.round((subtotalCents - vatAmountCents) * (PLATFORM_FEE_PERCENT / 100))
}

/** Recompute and persist a platform-order total from gross shop-order totals. */
export async function recalcPlatformOrderTotal(
  tx: Transaction,
  platformOrderId: string,
): Promise<number> {
  const [aggregate] = await tx
    .select({
      subtotal: sum(shopOrder.subtotalCents),
      shipping: sum(shopOrder.shippingCostCents),
    })
    .from(shopOrder)
    .where(eq(shopOrder.platformOrderId, platformOrderId))

  // Item and shipping amounts are VAT-inclusive. Adding the VAT columns again
  // would double-charge VAT and disagree with checkout and customer invoices.
  const computed = Number(aggregate?.subtotal ?? 0) + Number(aggregate?.shipping ?? 0)

  await tx
    .update(platformOrder)
    .set({ totalCents: computed, updatedAt: new Date() })
    .where(eq(platformOrder.id, platformOrderId))

  return computed
}

/** Recompute and persist a shop-order subtotal and item VAT from its items. */
export async function recalcShopOrderSubtotal(
  tx: Transaction,
  shopOrderId: string,
): Promise<{ subtotalCents: number; vatAmountCents: number }> {
  const [aggregate] = await tx
    .select({
      total: sum(orderItem.totalCents),
      vat: sum(orderItem.vatAmountCents),
    })
    .from(orderItem)
    .where(eq(orderItem.shopOrderId, shopOrderId))

  const subtotalCents = Number(aggregate?.total ?? 0)
  const vatAmountCents = Number(aggregate?.vat ?? 0)

  await tx
    .update(shopOrder)
    .set({ subtotalCents, vatAmountCents, updatedAt: new Date() })
    .where(eq(shopOrder.id, shopOrderId))

  return { subtotalCents, vatAmountCents }
}

/** Recompute and persist the total and VAT for one order item. */
export async function recalcOrderItemTotal(
  tx: Transaction,
  orderItemId: string,
): Promise<{ totalCents: number; vatAmountCents: number }> {
  const [row] = await tx
    .select({
      unitPriceCents: orderItem.unitPriceCents,
      quantity: orderItem.quantity,
      vatRateBasisPoints: orderItem.vatRateBasisPoints,
    })
    .from(orderItem)
    .where(eq(orderItem.id, orderItemId))

  if (!row) throw new Error(`Order item ${orderItemId} not found`)

  const totalCents = row.unitPriceCents * row.quantity
  const vatAmountCents = vatFromBasisPoints(totalCents, row.vatRateBasisPoints)

  await tx
    .update(orderItem)
    .set({ totalCents, vatAmountCents })
    .where(eq(orderItem.id, orderItemId))

  return { totalCents, vatAmountCents }
}

/** Recompute persisted totals while checkout still owns the write transaction. */
export async function recalcPlatformOrderTree(
  tx: Transaction,
  platformOrderId: string,
): Promise<void> {
  const shopOrderRows = await tx
    .select({ id: shopOrder.id })
    .from(shopOrder)
    .where(eq(shopOrder.platformOrderId, platformOrderId))

  for (const so of shopOrderRows) {
    const itemRows = (await tx
      .select({
        id: orderItem.id,
        unitPriceCents: orderItem.unitPriceCents,
        quantity: orderItem.quantity,
        vatRateBasisPoints: orderItem.vatRateBasisPoints,
        vatAmountCents: orderItem.vatAmountCents,
        totalCents: orderItem.totalCents,
      })
      .from(orderItem)
      .where(eq(orderItem.shopOrderId, so.id))) as OrderItemRow[]

    for (const item of itemRows) {
      const computedTotal = item.unitPriceCents * item.quantity
      const computedVat = vatFromBasisPoints(computedTotal, item.vatRateBasisPoints)
      if (computedTotal !== item.totalCents || computedVat !== item.vatAmountCents) {
        await tx
          .update(orderItem)
          .set({ totalCents: computedTotal, vatAmountCents: computedVat })
          .where(eq(orderItem.id, item.id))
      }
    }

    await recalcShopOrderSubtotal(tx, so.id)
  }

  await recalcPlatformOrderTotal(tx, platformOrderId)
}

/**
 * Explicit audit-record writer for an authorized, reviewed investigation.
 * Routine reconciliation never calls this function and runs in a read-only transaction.
 */
export async function recordFinancialDiscrepancy(
  tx: Transaction,
  input: {
    entityType: 'platform_order' | 'shop_order' | 'order_item'
    entityId: string
    fieldName: string
    storedCents: number
    computedCents: number
  },
): Promise<void> {
  await tx.insert(financialTotalAudit).values({
    entityType: input.entityType,
    entityId: input.entityId,
    fieldName: input.fieldName,
    storedCents: input.storedCents,
    computedCents: input.computedCents,
    diffCents: input.computedCents - input.storedCents,
  })
}

function emptyResult(): FinancialReconciliationResult {
  return {
    recordsChecked: {
      order_item: 0,
      shop_order: 0,
      platform_order: 0,
      invoice: 0,
      payout: 0,
    },
    mismatches: 0,
    mismatchCounts: Object.fromEntries(
      FINANCIAL_MISMATCH_CATEGORIES.map((category) => [category, 0]),
    ) as Record<FinancialMismatchCategory, number>,
  }
}

async function scanFinancialTotals(
  tx: Transaction,
  options: Required<Pick<FinancialReconciliationOptions, 'batchSize'>> &
    Pick<FinancialReconciliationOptions, 'onMismatch'>,
): Promise<FinancialReconciliationResult> {
  const result = emptyResult()
  const report = async (
    category: FinancialMismatchCategory,
    entityType: FinancialEntityType,
    entityId: string,
    fieldName: string,
    storedCents: number | null,
    computedCents: number | null,
  ) => {
    const mismatch: FinancialMismatch = {
      category,
      entityType,
      entityId,
      fieldName,
      storedCents,
      computedCents,
      differenceCents:
        storedCents === null || computedCents === null ? null : computedCents - storedCents,
    }
    result.mismatches += 1
    result.mismatchCounts[category] += 1
    await options.onMismatch?.(mismatch)
  }

  let lastItemId: string | undefined
  while (true) {
    const rows = (await tx
      .select({
        id: orderItem.id,
        unitPriceCents: orderItem.unitPriceCents,
        quantity: orderItem.quantity,
        vatRateBasisPoints: orderItem.vatRateBasisPoints,
        vatAmountCents: orderItem.vatAmountCents,
        totalCents: orderItem.totalCents,
      })
      .from(orderItem)
      .where(lastItemId ? gt(orderItem.id, lastItemId) : undefined)
      .orderBy(asc(orderItem.id))
      .limit(options.batchSize)) as OrderItemRow[]

    for (const item of rows) {
      result.recordsChecked.order_item += 1
      const computedTotal = item.unitPriceCents * item.quantity
      const computedVat = vatFromBasisPoints(computedTotal, item.vatRateBasisPoints)
      if (computedTotal !== item.totalCents) {
        await report(
          'order_item_total',
          'order_item',
          item.id,
          'totalCents',
          item.totalCents,
          computedTotal,
        )
      }
      if (computedVat !== item.vatAmountCents) {
        await report(
          'order_item_vat',
          'order_item',
          item.id,
          'vatAmountCents',
          item.vatAmountCents,
          computedVat,
        )
      }
    }
    if (rows.length < options.batchSize) break
    lastItemId = rows.at(-1)?.id
  }

  let lastShopOrderId: string | undefined
  while (true) {
    const rows = await tx
      .select({
        id: shopOrder.id,
        status: shopOrder.status,
        shippingMethod: shopOrder.shippingMethod,
        subtotalCents: shopOrder.subtotalCents,
        shippingCostCents: shopOrder.shippingCostCents,
        vatAmountCents: shopOrder.vatAmountCents,
        refundedCents: shopOrder.refundedCents,
        refundPendingCents: shopOrder.refundPendingCents,
      })
      .from(shopOrder)
      .where(lastShopOrderId ? gt(shopOrder.id, lastShopOrderId) : undefined)
      .orderBy(asc(shopOrder.id))
      .limit(options.batchSize)

    const ids = rows.map(({ id }) => id)
    const itemAggregates =
      ids.length === 0
        ? []
        : await tx
            .select({
              shopOrderId: orderItem.shopOrderId,
              total: sum(orderItem.totalCents),
              vat: sum(orderItem.vatAmountCents),
            })
            .from(orderItem)
            .where(inArray(orderItem.shopOrderId, ids))
            .groupBy(orderItem.shopOrderId)
    const aggregateByOrder = new Map(itemAggregates.map((row) => [row.shopOrderId, row]))

    const invoiceRows =
      ids.length === 0
        ? []
        : await tx
            .select({
              id: invoices.id,
              shopOrderId: invoices.shopOrderId,
              type: invoices.type,
              subtotalCents: invoices.subtotalCents,
              vatAmountCents: invoices.vatAmountCents,
              totalCents: invoices.totalCents,
            })
            .from(invoices)
            .where(inArray(invoices.shopOrderId, ids))
    const invoicesByOrder = new Map<string, typeof invoiceRows>()
    for (const invoice of invoiceRows) {
      result.recordsChecked.invoice += 1
      const existing = invoicesByOrder.get(invoice.shopOrderId) ?? []
      existing.push(invoice)
      invoicesByOrder.set(invoice.shopOrderId, existing)
      const computedTotal = invoice.subtotalCents + invoice.vatAmountCents
      if (invoice.totalCents !== computedTotal) {
        await report(
          'invoice_total',
          'invoice',
          invoice.id,
          'totalCents',
          invoice.totalCents,
          computedTotal,
        )
      }
    }

    const payoutRows =
      ids.length === 0
        ? []
        : await tx
            .select({
              id: payout.id,
              shopOrderId: payout.shopOrderId,
              amountCents: payout.amountCents,
              status: payout.status,
              molliePaymentId: payout.molliePaymentId,
              mollieRouteId: payout.mollieRouteId,
              executedAt: payout.executedAt,
              sentAt: payout.sentAt,
              reversedAt: payout.reversedAt,
              returnedAt: payout.returnedAt,
            })
            .from(payout)
            .where(inArray(payout.shopOrderId, ids))
    const payoutByOrder = new Map(payoutRows.map((row) => [row.shopOrderId, row]))
    result.recordsChecked.payout += payoutRows.length

    for (const order of rows) {
      result.recordsChecked.shop_order += 1
      const aggregate = aggregateByOrder.get(order.id)
      const computedSubtotal = Number(aggregate?.total ?? 0)
      const computedVat = Number(aggregate?.vat ?? 0)
      const grossTotal = order.subtotalCents + order.shippingCostCents
      if (order.subtotalCents !== computedSubtotal) {
        await report(
          'shop_order_subtotal',
          'shop_order',
          order.id,
          'subtotalCents',
          order.subtotalCents,
          computedSubtotal,
        )
      }
      if (order.vatAmountCents !== computedVat) {
        await report(
          'shop_order_vat',
          'shop_order',
          order.id,
          'vatAmountCents',
          order.vatAmountCents,
          computedVat,
        )
      }
      if (order.refundedCents < 0 || order.refundedCents + order.refundPendingCents > grossTotal) {
        await report(
          'shop_order_refund',
          'shop_order',
          order.id,
          'refundedCents',
          order.refundedCents + order.refundPendingCents,
          grossTotal,
        )
      }

      const orderInvoices = invoicesByOrder.get(order.id) ?? []
      const customerInvoices = orderInvoices.filter(({ type }) => type === 'customer')
      const platformFeeInvoices = orderInvoices.filter(({ type }) => type === 'platform_fee')
      const creditNotes = orderInvoices.filter(({ type }) => type === 'credit_note')
      const invoicesExpected = !['pending_payment', 'cancelled'].includes(order.status)
      if (invoicesExpected && (customerInvoices.length !== 1 || platformFeeInvoices.length !== 1)) {
        await report(
          'financial_state_incomplete',
          'shop_order',
          order.id,
          'invoiceSetCount',
          customerInvoices.length + platformFeeInvoices.length,
          2,
        )
      }

      for (const invoice of customerInvoices) {
        if (invoice.totalCents !== grossTotal) {
          await report(
            'customer_invoice_order',
            'invoice',
            invoice.id,
            'totalCents',
            invoice.totalCents,
            grossTotal,
          )
        }
      }

      const expectedFee = platformFeeCents(order.subtotalCents, order.vatAmountCents)
      for (const invoice of platformFeeInvoices) {
        if (invoice.totalCents !== expectedFee) {
          await report(
            'platform_fee_invoice',
            'invoice',
            invoice.id,
            'totalCents',
            invoice.totalCents,
            expectedFee,
          )
        }
      }

      const creditedCents = -creditNotes.reduce((total, note) => total + note.totalCents, 0)
      if (creditedCents !== order.refundedCents) {
        await report(
          'credit_note_refund',
          'shop_order',
          order.id,
          'creditedCents',
          creditedCents,
          order.refundedCents,
        )
      }

      const payoutRow = payoutByOrder.get(order.id)
      if (!payoutRow) continue
      const expectedPayout =
        order.subtotalCents -
        expectedFee +
        (order.shippingMethod === 'manual' ? order.shippingCostCents : 0)
      if (payoutRow.amountCents !== expectedPayout) {
        await report(
          'payout_amount',
          'payout',
          payoutRow.id,
          'amountCents',
          payoutRow.amountCents,
          expectedPayout,
        )
      }
      const feeInvoice = platformFeeInvoices[0]
      if (feeInvoice) {
        const invoiceDerivedPayout =
          order.subtotalCents -
          feeInvoice.totalCents +
          (order.shippingMethod === 'manual' ? order.shippingCostCents : 0)
        if (payoutRow.amountCents !== invoiceDerivedPayout) {
          await report(
            'payout_invoice_disagreement',
            'payout',
            payoutRow.id,
            'amountCents',
            payoutRow.amountCents,
            invoiceDerivedPayout,
          )
        }
      }

      const providerStateIncomplete =
        (['in_transit', 'sent'].includes(payoutRow.status) &&
          (!payoutRow.molliePaymentId || !payoutRow.mollieRouteId || !payoutRow.executedAt)) ||
        (payoutRow.status === 'sent' && !payoutRow.sentAt) ||
        (payoutRow.status === 'reversed' && !payoutRow.reversedAt) ||
        (payoutRow.status === 'returned' && !payoutRow.returnedAt)
      if (providerStateIncomplete) {
        await report(
          'provider_state_incomplete',
          'payout',
          payoutRow.id,
          'providerState',
          null,
          null,
        )
      }
      if (order.status === 'chargeback' && !['reversed', 'returned'].includes(payoutRow.status)) {
        await report('chargeback_payout', 'payout', payoutRow.id, 'status', null, null)
      }
    }

    if (rows.length < options.batchSize) break
    lastShopOrderId = rows.at(-1)?.id
  }

  let lastPlatformOrderId: string | undefined
  while (true) {
    const rows = await tx
      .select({
        id: platformOrder.id,
        totalCents: platformOrder.totalCents,
        refundedCents: platformOrder.refundedCents,
      })
      .from(platformOrder)
      .where(lastPlatformOrderId ? gt(platformOrder.id, lastPlatformOrderId) : undefined)
      .orderBy(asc(platformOrder.id))
      .limit(options.batchSize)
    const ids = rows.map(({ id }) => id)
    const aggregates =
      ids.length === 0
        ? []
        : await tx
            .select({
              platformOrderId: shopOrder.platformOrderId,
              subtotal: sum(shopOrder.subtotalCents),
              shipping: sum(shopOrder.shippingCostCents),
              refunded: sum(shopOrder.refundedCents),
            })
            .from(shopOrder)
            .where(inArray(shopOrder.platformOrderId, ids))
            .groupBy(shopOrder.platformOrderId)
    const aggregateByOrder = new Map(aggregates.map((row) => [row.platformOrderId, row]))

    for (const order of rows) {
      result.recordsChecked.platform_order += 1
      const aggregate = aggregateByOrder.get(order.id)
      const computedTotal = Number(aggregate?.subtotal ?? 0) + Number(aggregate?.shipping ?? 0)
      const computedRefund = Number(aggregate?.refunded ?? 0)
      if (order.totalCents !== computedTotal) {
        await report(
          'platform_order_total',
          'platform_order',
          order.id,
          'totalCents',
          order.totalCents,
          computedTotal,
        )
      }
      if (order.refundedCents !== computedRefund) {
        await report(
          'platform_order_refund',
          'platform_order',
          order.id,
          'refundedCents',
          order.refundedCents,
          computedRefund,
        )
      }
    }

    if (rows.length < options.batchSize) break
    lastPlatformOrderId = rows.at(-1)?.id
  }

  return result
}

/**
 * Detect financial drift in a stable, read-only PostgreSQL snapshot.
 *
 * No accounting, order, invoice, refund, payout, audit, or ledger row is
 * inserted or updated. Repairs remain a separate owner-authorized procedure.
 */
export async function reconcileFinancialTotals(
  options: FinancialReconciliationOptions = {},
): Promise<FinancialReconciliationResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5_000) {
    throw new Error('Financial reconciliation batch size must be an integer between 1 and 5000')
  }

  return db.transaction(
    async (tx) => scanFinancialTotals(tx, { batchSize, onMismatch: options.onMismatch }),
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}
