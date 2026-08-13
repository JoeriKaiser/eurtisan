import '@tanstack/react-start/server-only'

import { and, eq, isNotNull, lte, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { orderItem, platformOrder, product, productVariant, shopOrder } from '#/db/schema'
import { molliePaymentProvider } from '#/integrations/mollie'
import { handleChargeback } from '#/lib/chargebacks.server'
import { decrementStockForPaidOrder } from '#/lib/inventory.server'
import { logger } from '#/lib/logger.server'
import {
  mollieOldestPendingPaymentAgeSeconds,
  molliePaymentReconciliationErrorsTotal,
  molliePendingPayments,
  ordersCancelledTotal,
  ordersPaidTotal,
} from '#/lib/metrics.server'
import { logOrderPaid } from '#/lib/order-logger'
import type { PaymentProvider } from '#/lib/payment-provider'
import { createDeliveryPromiseSnapshot } from '#/lib/disputes/non-delivery'

export type MolliePaymentReconciliationStatus =
  | 'already_processed'
  | 'amount_mismatch'
  | 'cancelled'
  | 'chargeback'
  | 'inventory_mismatch'
  | 'pending'
  | 'processed'
  | 'refunded_after_cancellation'
  | 'unknown_payment'

export interface MolliePaymentReconciliationResult {
  status: MolliePaymentReconciliationStatus
  platformOrderId?: string
}

export interface ReconcilePendingMolliePaymentsResult {
  checked: number
  processed: number
  pending: number
  manualReview: number
  errors: number
}

type Database = typeof db

type InternalPaidTransitionResult =
  | { status: 'already_processed' }
  | { status: 'cancelled_after_provider_lookup' }
  | { status: 'inventory_mismatch' }
  | { status: 'processed'; totalCents: number }

const CHARGEBACK_ELIGIBLE_STATUSES = new Set([
  'paid',
  'processing',
  'shipped',
  'delivered',
  'completed',
])

/**
 * Retrieve the authoritative Mollie payment state and apply its order transition.
 *
 * Both the classic webhook and the fallback reconciliation worker call this
 * function. Provider and database errors intentionally propagate so the webhook
 * can return a non-2xx response and the worker can record a failed attempt.
 */
export async function reconcileMolliePayment(
  molliePaymentId: string,
  options?: {
    db?: Database
    paymentProvider?: PaymentProvider
  },
): Promise<MolliePaymentReconciliationResult> {
  const database = options?.db ?? db
  const provider = options?.paymentProvider ?? molliePaymentProvider

  const [order] = await database
    .select({
      id: platformOrder.id,
      status: platformOrder.status,
      totalCents: platformOrder.totalCents,
    })
    .from(platformOrder)
    .where(eq(platformOrder.molliePaymentId, molliePaymentId))
    .limit(1)

  if (!order) {
    return { status: 'unknown_payment' }
  }

  const chargebackEligible = CHARGEBACK_ELIGIBLE_STATUSES.has(order.status)
  const needsAuthoritativeLookup =
    order.status === 'pending_payment' || order.status === 'cancelled' || chargebackEligible

  if (!needsAuthoritativeLookup) {
    return { status: 'already_processed', platformOrderId: order.id }
  }

  const paymentStatus = await provider.getPaymentStatus(molliePaymentId)

  if (order.status === 'cancelled') {
    if (paymentStatus !== 'paid') {
      return { status: 'already_processed', platformOrderId: order.id }
    }

    return refundCancelledOrder(order.id, molliePaymentId, provider)
  }

  if (chargebackEligible && paymentStatus !== 'chargeback') {
    return { status: 'already_processed', platformOrderId: order.id }
  }

  if (paymentStatus === 'chargeback') {
    if (!chargebackEligible) {
      return { status: 'already_processed', platformOrderId: order.id }
    }

    const result = await handleChargeback(molliePaymentId, { db: database })
    return {
      status: result.status,
      platformOrderId: order.id,
    }
  }

  if (paymentStatus === 'paid') {
    const paymentAmountCents = await provider.getPaymentAmount(molliePaymentId)

    if (paymentAmountCents !== order.totalCents) {
      logger.error('Mollie payment amount mismatch', undefined, {
        alert: true,
        platformOrderId: order.id,
        expectedCents: order.totalCents,
        receivedCents: paymentAmountCents,
        molliePaymentId,
      })

      const status = await markAmountMismatchForManualReview(database, order.id)
      return { status, platformOrderId: order.id }
    }

    const transition = await markPendingOrderPaid(database, order.id, molliePaymentId)

    if (transition.status === 'cancelled_after_provider_lookup') {
      return refundCancelledOrder(order.id, molliePaymentId, provider)
    }

    if (transition.status === 'processed') {
      ordersPaidTotal.inc()
      logOrderPaid({
        platformOrderId: order.id,
        totalCents: transition.totalCents,
        paymentStatus: 'paid',
      })
    }

    return { status: transition.status, platformOrderId: order.id }
  }

  if (paymentStatus === 'expired' || paymentStatus === 'failed' || paymentStatus === 'cancelled') {
    const status = await cancelPendingOrder(database, order.id, paymentStatus)
    if (status === 'cancelled') {
      ordersCancelledTotal.inc()
    }
    return { status, platformOrderId: order.id }
  }

  return { status: 'pending', platformOrderId: order.id }
}

async function refundCancelledOrder(
  platformOrderId: string,
  molliePaymentId: string,
  provider: PaymentProvider,
): Promise<MolliePaymentReconciliationResult> {
  const { refundCancelledPlatformOrder } = await import('#/lib/shop-orders.server')
  const refundedCents = await refundCancelledPlatformOrder(
    platformOrderId,
    molliePaymentId,
    provider,
  )

  return {
    status: refundedCents > 0 ? 'refunded_after_cancellation' : 'already_processed',
    platformOrderId,
  }
}

async function markAmountMismatchForManualReview(
  database: Database,
  platformOrderId: string,
): Promise<'amount_mismatch' | 'already_processed'> {
  return database.transaction(async (tx) => {
    const [lockedOrder] = await tx
      .select({ status: platformOrder.status })
      .from(platformOrder)
      .where(eq(platformOrder.id, platformOrderId))
      .for('update')
      .limit(1)

    if (!lockedOrder || lockedOrder.status !== 'pending_payment') {
      return 'already_processed'
    }

    const now = new Date()
    await tx
      .update(platformOrder)
      .set({ status: 'manual_review', updatedAt: now })
      .where(eq(platformOrder.id, platformOrderId))

    await tx
      .update(shopOrder)
      .set({ status: 'manual_review', updatedAt: now })
      .where(eq(shopOrder.platformOrderId, platformOrderId))

    return 'amount_mismatch'
  })
}

async function markPendingOrderPaid(
  database: Database,
  platformOrderId: string,
  molliePaymentId: string,
): Promise<InternalPaidTransitionResult> {
  const { createInvoicesForPlatformOrder } = await import('#/lib/invoices.server')

  return database.transaction(async (tx) => {
    const [lockedOrder] = await tx
      .select({
        id: platformOrder.id,
        status: platformOrder.status,
      })
      .from(platformOrder)
      .where(eq(platformOrder.id, platformOrderId))
      .for('update')
      .limit(1)

    if (!lockedOrder) {
      return { status: 'already_processed' }
    }

    if (lockedOrder.status === 'cancelled') {
      return { status: 'cancelled_after_provider_lookup' }
    }

    if (lockedOrder.status !== 'pending_payment') {
      return { status: 'already_processed' }
    }

    const items = await tx
      .select({
        productId: orderItem.productId,
        variantId: orderItem.variantId,
        quantity: orderItem.quantity,
      })
      .from(orderItem)
      .innerJoin(shopOrder, eq(orderItem.shopOrderId, shopOrder.id))
      .where(eq(shopOrder.platformOrderId, platformOrderId))

    const aggregates = new Map<
      string,
      { productId: string; variantId: string | null; quantity: number }
    >()

    for (const item of items) {
      const key = `${item.productId}:${item.variantId ?? ''}`
      const existing = aggregates.get(key)
      if (existing) {
        existing.quantity += item.quantity
      } else {
        aggregates.set(key, {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })
      }
    }

    const stockMismatches: Array<{
      productId: string
      variantId: string | null
      available: number
      requested: number
    }> = []

    for (const entry of aggregates.values()) {
      if (entry.variantId) {
        const [variantRow] = await tx
          .select({ stockCount: productVariant.stockCount })
          .from(productVariant)
          .where(eq(productVariant.id, entry.variantId))
          .for('update')
          .limit(1)

        if (!variantRow || variantRow.stockCount < entry.quantity) {
          stockMismatches.push({
            productId: entry.productId,
            variantId: entry.variantId,
            available: variantRow?.stockCount ?? 0,
            requested: entry.quantity,
          })
        }
      } else {
        const [productRow] = await tx
          .select({ stockCount: product.stockCount })
          .from(product)
          .where(eq(product.id, entry.productId))
          .for('update')
          .limit(1)

        if (!productRow || productRow.stockCount < entry.quantity) {
          stockMismatches.push({
            productId: entry.productId,
            variantId: null,
            available: productRow?.stockCount ?? 0,
            requested: entry.quantity,
          })
        }
      }
    }

    if (stockMismatches.length > 0) {
      logger.error('Mollie payment inventory mismatch', undefined, {
        alert: true,
        platformOrderId,
        mismatches: stockMismatches,
        molliePaymentId,
      })

      const now = new Date()
      await tx
        .update(platformOrder)
        .set({ status: 'manual_review', updatedAt: now })
        .where(eq(platformOrder.id, platformOrderId))

      await tx
        .update(shopOrder)
        .set({ status: 'manual_review', updatedAt: now })
        .where(eq(shopOrder.platformOrderId, platformOrderId))

      return { status: 'inventory_mismatch' }
    }

    const paidAt = new Date()
    const [platformOrderRecord] = await tx
      .update(platformOrder)
      .set({ status: 'paid', paidAt, updatedAt: paidAt })
      .where(eq(platformOrder.id, platformOrderId))
      .returning({ totalCents: platformOrder.totalCents })

    const shopOrderPromises = await tx
      .select({
        id: shopOrder.id,
        processingTimeMaxBusinessDays: shopOrder.processingTimeMaxBusinessDays,
        transitTimeMinBusinessDays: shopOrder.transitTimeMinBusinessDays,
        transitTimeMaxBusinessDays: shopOrder.transitTimeMaxBusinessDays,
      })
      .from(shopOrder)
      .where(eq(shopOrder.platformOrderId, platformOrderId))

    for (const orderPromise of shopOrderPromises) {
      const promise = createDeliveryPromiseSnapshot({
        paidAt,
        processingTimeMaxBusinessDays: orderPromise.processingTimeMaxBusinessDays,
        transitTimeMinBusinessDays: orderPromise.transitTimeMinBusinessDays,
        transitTimeMaxBusinessDays: orderPromise.transitTimeMaxBusinessDays,
      })
      await tx
        .update(shopOrder)
        .set({
          status: 'paid',
          fulfillmentDueAt: promise.fulfillmentDueAt,
          earliestDeliveryAt: promise.earliestDeliveryAt,
          deliveryDueAt: promise.deliveryDueAt,
          updatedAt: paidAt,
        })
        .where(eq(shopOrder.id, orderPromise.id))
    }

    await createInvoicesForPlatformOrder(platformOrderId, tx)
    await decrementStockForPaidOrder(tx, platformOrderId)

    return {
      status: 'processed',
      totalCents: platformOrderRecord?.totalCents ?? 0,
    }
  })
}

async function cancelPendingOrder(
  database: Database,
  platformOrderId: string,
  paymentStatus: 'expired' | 'failed' | 'cancelled',
): Promise<'cancelled' | 'already_processed'> {
  return database.transaction(async (tx) => {
    const [lockedOrder] = await tx
      .select({ status: platformOrder.status })
      .from(platformOrder)
      .where(eq(platformOrder.id, platformOrderId))
      .for('update')
      .limit(1)

    if (!lockedOrder || lockedOrder.status !== 'pending_payment') {
      return 'already_processed'
    }

    const cancellationReason =
      paymentStatus === 'expired'
        ? 'Payment expired'
        : paymentStatus === 'failed'
          ? 'Payment failed'
          : 'Payment cancelled by buyer'
    const now = new Date()

    await tx
      .update(platformOrder)
      .set({
        status: 'cancelled',
        cancelledAt: now,
        updatedAt: now,
        cancellationReason,
      })
      .where(eq(platformOrder.id, platformOrderId))

    await tx
      .update(shopOrder)
      .set({ status: 'cancelled', updatedAt: now })
      .where(eq(shopOrder.platformOrderId, platformOrderId))

    // Keep the order reservation until its existing expiry so the buyer can
    // retry a failed, expired, or user-cancelled payment on the same order.
    // Availability calculations ignore expired reservations automatically.
    return 'cancelled'
  })
}

/**
 * Reconcile pending Mollie-backed orders that may have missed their webhook.
 */
export async function reconcilePendingMolliePayments(options?: {
  db?: Database
  paymentProvider?: PaymentProvider
  minAgeMs?: number
  batchSize?: number
  now?: Date
}): Promise<ReconcilePendingMolliePaymentsResult> {
  const database = options?.db ?? db
  const provider = options?.paymentProvider ?? molliePaymentProvider
  const minAgeMs = options?.minAgeMs ?? 60_000
  const batchSize = options?.batchSize ?? 100
  const now = options?.now ?? new Date()
  const cutoff = new Date(now.getTime() - minAgeMs)

  const [backlog] = await database
    .select({
      count: sql<number>`count(*)::int`,
      oldestUpdatedAt: sql<Date | null>`min(${platformOrder.updatedAt})`,
    })
    .from(platformOrder)
    .where(
      and(eq(platformOrder.status, 'pending_payment'), isNotNull(platformOrder.molliePaymentId)),
    )

  const pendingCount = Number(backlog?.count ?? 0)
  molliePendingPayments.set(pendingCount)
  mollieOldestPendingPaymentAgeSeconds.set(
    backlog?.oldestUpdatedAt
      ? Math.max(0, (now.getTime() - new Date(backlog.oldestUpdatedAt).getTime()) / 1000)
      : 0,
  )

  const candidates = await database
    .select({ molliePaymentId: platformOrder.molliePaymentId })
    .from(platformOrder)
    .where(
      and(
        eq(platformOrder.status, 'pending_payment'),
        isNotNull(platformOrder.molliePaymentId),
        lte(platformOrder.updatedAt, cutoff),
      ),
    )
    .orderBy(platformOrder.updatedAt)
    .limit(batchSize)

  const result: ReconcilePendingMolliePaymentsResult = {
    checked: 0,
    processed: 0,
    pending: 0,
    manualReview: 0,
    errors: 0,
  }

  for (const candidate of candidates) {
    if (!candidate.molliePaymentId) continue
    result.checked += 1

    try {
      const reconciliation = await reconcileMolliePayment(candidate.molliePaymentId, {
        db: database,
        paymentProvider: provider,
      })

      if (
        reconciliation.status === 'processed' ||
        reconciliation.status === 'cancelled' ||
        reconciliation.status === 'refunded_after_cancellation'
      ) {
        result.processed += 1
      } else if (
        reconciliation.status === 'amount_mismatch' ||
        reconciliation.status === 'inventory_mismatch'
      ) {
        result.manualReview += 1
      } else {
        result.pending += 1
      }
    } catch (error) {
      result.errors += 1
      molliePaymentReconciliationErrorsTotal.inc()
      logger.error('Mollie pending payment reconciliation failed', error, {
        alert: true,
        molliePaymentId: candidate.molliePaymentId,
      })
    }
  }

  return result
}
