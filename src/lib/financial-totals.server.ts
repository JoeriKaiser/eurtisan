import { eq, sum } from 'drizzle-orm'

import { financialTotalAudit, orderItem, platformOrder, shopOrder } from '#/db/schema'
import type { db } from '#/db/index'

export type Transaction = Omit<typeof db, '$client'>

interface OrderItemRow {
  id: string
  unitPriceCents: number
  quantity: number
  vatRateBasisPoints: number
  vatAmountCents: number
  totalCents: number
}

function vatFromBasisPoints(amountCents: number, basisPoints: number): number {
  return Math.round((amountCents * basisPoints) / 10000)
}

/**
 * Recompute and persist the total for a platform order from its shop orders.
 */
export async function recalcPlatformOrderTotal(
  tx: Transaction,
  platformOrderId: string,
): Promise<number> {
  const [aggregate] = await tx
    .select({
      subtotal: sum(shopOrder.subtotalCents),
      shipping: sum(shopOrder.shippingCostCents),
      vat: sum(shopOrder.vatAmountCents),
      shippingVat: sum(shopOrder.shippingVatAmountCents),
    })
    .from(shopOrder)
    .where(eq(shopOrder.platformOrderId, platformOrderId))

  const computed =
    Number(aggregate?.subtotal ?? 0) +
    Number(aggregate?.shipping ?? 0) +
    Number(aggregate?.vat ?? 0) +
    Number(aggregate?.shippingVat ?? 0)

  await tx
    .update(platformOrder)
    .set({ totalCents: computed, updatedAt: new Date() })
    .where(eq(platformOrder.id, platformOrderId))

  return computed
}

/**
 * Recompute and persist the subtotal and item VAT for a shop order from its
 * order items. Shipping VAT is not recomputed here because it depends on the
 * shipping method/rate selected at checkout.
 */
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

/**
 * Recompute and persist the total and VAT for a single order item.
 */
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

  if (!row) {
    throw new Error(`Order item ${orderItemId} not found`)
  }

  const totalCents = row.unitPriceCents * row.quantity
  const vatAmountCents = vatFromBasisPoints(totalCents, row.vatRateBasisPoints)

  await tx
    .update(orderItem)
    .set({ totalCents, vatAmountCents })
    .where(eq(orderItem.id, orderItemId))

  return { totalCents, vatAmountCents }
}

/**
 * Recompute all derived totals for a newly created platform order and its
 * shop orders / order items. Intended to be called at the end of checkout.
 */
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
 * Audit helper: record a discrepancy between a stored total and the computed total.
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

/**
 * Scan all order-related totals and record any discrepancies.
 * Returns the number of discrepancies found.
 */
export async function reconcileFinancialTotals(tx: Transaction): Promise<number> {
  let discrepancyCount = 0

  // Order items
  const itemRows = (await tx
    .select({
      id: orderItem.id,
      unitPriceCents: orderItem.unitPriceCents,
      quantity: orderItem.quantity,
      vatRateBasisPoints: orderItem.vatRateBasisPoints,
      vatAmountCents: orderItem.vatAmountCents,
      totalCents: orderItem.totalCents,
    })
    .from(orderItem)) as OrderItemRow[]

  for (const item of itemRows) {
    const computedTotal = item.unitPriceCents * item.quantity
    const computedVat = vatFromBasisPoints(computedTotal, item.vatRateBasisPoints)
    if (computedTotal !== item.totalCents || computedVat !== item.vatAmountCents) {
      await recordFinancialDiscrepancy(tx, {
        entityType: 'order_item',
        entityId: item.id,
        fieldName: computedTotal !== item.totalCents ? 'totalCents' : 'vatAmountCents',
        storedCents: computedTotal !== item.totalCents ? item.totalCents : item.vatAmountCents,
        computedCents: computedTotal !== item.totalCents ? computedTotal : computedVat,
      })
      discrepancyCount++
    }
  }

  // Shop orders
  const shopOrderRows = await tx
    .select({
      id: shopOrder.id,
      subtotalCents: shopOrder.subtotalCents,
      shippingCostCents: shopOrder.shippingCostCents,
      refundedCents: shopOrder.refundedCents,
    })
    .from(shopOrder)

  for (const so of shopOrderRows) {
    const [aggregate] = await tx
      .select({ total: sum(orderItem.totalCents) })
      .from(orderItem)
      .where(eq(orderItem.shopOrderId, so.id))
    const computedSubtotal = Number(aggregate?.total ?? 0)
    if (computedSubtotal !== so.subtotalCents) {
      await recordFinancialDiscrepancy(tx, {
        entityType: 'shop_order',
        entityId: so.id,
        fieldName: 'subtotalCents',
        storedCents: so.subtotalCents,
        computedCents: computedSubtotal,
      })
      discrepancyCount++
    }

    // Refund caps are enforced by DB check constraints; we only audit here.
    if (so.refundedCents > so.subtotalCents + so.shippingCostCents) {
      await recordFinancialDiscrepancy(tx, {
        entityType: 'shop_order',
        entityId: so.id,
        fieldName: 'refundedCents',
        storedCents: so.refundedCents,
        computedCents: so.subtotalCents + so.shippingCostCents,
      })
      discrepancyCount++
    }
  }

  // Platform orders
  const platformOrderRows = await tx
    .select({
      id: platformOrder.id,
      totalCents: platformOrder.totalCents,
      refundedCents: platformOrder.refundedCents,
    })
    .from(platformOrder)

  for (const po of platformOrderRows) {
    const [aggregate] = await tx
      .select({
        subtotal: sum(shopOrder.subtotalCents),
        shipping: sum(shopOrder.shippingCostCents),
        vat: sum(shopOrder.vatAmountCents),
        shippingVat: sum(shopOrder.shippingVatAmountCents),
      })
      .from(shopOrder)
      .where(eq(shopOrder.platformOrderId, po.id))

    const computedTotal =
      Number(aggregate?.subtotal ?? 0) +
      Number(aggregate?.shipping ?? 0) +
      Number(aggregate?.vat ?? 0) +
      Number(aggregate?.shippingVat ?? 0)

    if (computedTotal !== po.totalCents) {
      await recordFinancialDiscrepancy(tx, {
        entityType: 'platform_order',
        entityId: po.id,
        fieldName: 'totalCents',
        storedCents: po.totalCents,
        computedCents: computedTotal,
      })
      discrepancyCount++
    }

    if (po.refundedCents > po.totalCents) {
      await recordFinancialDiscrepancy(tx, {
        entityType: 'platform_order',
        entityId: po.id,
        fieldName: 'refundedCents',
        storedCents: po.refundedCents,
        computedCents: po.totalCents,
      })
      discrepancyCount++
    }
  }

  return discrepancyCount
}
