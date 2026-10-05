import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { platformOrder, shop, shopOrder } from '#/db/schema'
import { molliePaymentProvider } from '#/integrations/mollie'
import { scheduleBackgroundWork } from '../background-work.server'
import { createCreditNoteForShopOrder } from '../invoices.server'
import { restoreShopOrderStockInTx } from '../inventory.server'
import { m } from '#/paraglide/messages'
import { logger } from '../logger.server'
import { ordersCancelledTotal } from '../metrics.server'
import { reversePayoutForRefund, type PayoutReversalOptions } from '../payouts.server'
import { recalcPlatformOrderStatus } from '../shop-orders.server'
import type { OrderStatus } from '../orders.server'

const CHARGEBACK_ELIGIBLE_STATUSES: OrderStatus[] = [
  'paid',
  'processing',
  'shipped',
  'delivered',
  'completed',
]

export interface ChargebackResult {
  status: 'chargeback' | 'already_processed' | 'unknown_payment'
}

/**
 * Handle a Mollie chargeback notification.
 *
 * This is intentionally separate from the normal payment webhook: chargebacks
 * reverse money that has already left the buyer's account and may require
 * clawing back a routed seller payout, issuing a credit note, and restoring
 * stock. All of that work happens in a single database transaction so the
 * outcome is atomic and retry-safe.
 */
export async function handleChargeback(
  molliePaymentId: string,
  options?: { db?: typeof db },
): Promise<ChargebackResult> {
  const database = options?.db ?? db

  const [order] = await database
    .select({
      id: platformOrder.id,
      orderNumber: platformOrder.orderNumber,
      status: platformOrder.status,
      totalCents: platformOrder.totalCents,
    })
    .from(platformOrder)
    .where(eq(platformOrder.molliePaymentId, molliePaymentId))
    .limit(1)

  if (!order) {
    return { status: 'unknown_payment' }
  }

  if (order.status === 'chargeback') {
    return { status: 'already_processed' }
  }

  if (!CHARGEBACK_ELIGIBLE_STATUSES.includes(order.status as OrderStatus)) {
    return { status: 'already_processed' }
  }

  const routingReversals = await database.transaction(async (tx) => {
    const collected: Array<{ refundCents: number; options: PayoutReversalOptions }> = []
    const [lockedOrder] = await tx
      .select({
        id: platformOrder.id,
        orderNumber: platformOrder.orderNumber,
        status: platformOrder.status,
        totalCents: platformOrder.totalCents,
      })
      .from(platformOrder)
      .where(eq(platformOrder.id, order.id))
      .for('update')
      .limit(1)

    if (!lockedOrder || lockedOrder.status === 'chargeback') {
      return collected
    }

    const shopOrders = await tx
      .select({
        id: shopOrder.id,
        platformOrderId: shopOrder.platformOrderId,
        subtotalCents: shopOrder.subtotalCents,
        shippingCostCents: shopOrder.shippingCostCents,
        refundedCents: shopOrder.refundedCents,
      })
      .from(shopOrder)
      .where(eq(shopOrder.platformOrderId, lockedOrder.id))
      .for('update')

    for (const so of shopOrders) {
      const shopOrderTotal = so.subtotalCents + so.shippingCostCents
      const remainingRefundCents = Math.max(0, shopOrderTotal - so.refundedCents)

      if (remainingRefundCents > 0) {
        const reversalOptions = await reversePayoutForRefund(
          tx,
          so.id,
          remainingRefundCents,
          'chargeback',
        )
        if (
          reversalOptions.reverseRouting ||
          (reversalOptions.routingReversals && reversalOptions.routingReversals.length > 0)
        ) {
          collected.push({ refundCents: remainingRefundCents, options: reversalOptions })
        }
        await createCreditNoteForShopOrder(so.id, tx)
      }

      await tx
        .update(shopOrder)
        .set({
          status: 'chargeback',
          refundedCents: so.refundedCents + remainingRefundCents,
          updatedAt: new Date(),
        })
        .where(eq(shopOrder.id, so.id))

      await restoreShopOrderStockInTx(tx, so.platformOrderId, so.id)
    }

    await tx
      .update(platformOrder)
      .set({
        status: 'chargeback',
        refundedCents: lockedOrder.totalCents,
        cancellationReason: 'payment_chargeback',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(platformOrder.id, lockedOrder.id))

    await recalcPlatformOrderStatus(tx, lockedOrder.id)
    return collected
  })

  for (const reversal of routingReversals) {
    try {
      await molliePaymentProvider.refundPayment(molliePaymentId, reversal.refundCents, {
        ...reversal.options,
        idempotencyKey: `chargeback-reverse:${order.id}:${reversal.refundCents}`,
      })
    } catch (err) {
      logger.error('Mollie routing reverse failed after chargeback', err, {
        alert: true,
        platformOrderId: order.id,
        molliePaymentId,
        refundCents: reversal.refundCents,
      })
    }
  }

  ordersCancelledTotal.inc()
  logger.error('Chargeback processed for platform order', undefined, {
    alert: true,
    platformOrderId: order.id,
    molliePaymentId,
  })

  scheduleBackgroundWork(`chargeback-notifications-${order.id}`, async () => {
    const [{ createNotification }, affected] = await Promise.all([
      import('../notifications.server'),
      db
        .select({ id: shopOrder.id, shopId: shopOrder.shopId })
        .from(shopOrder)
        .where(eq(shopOrder.platformOrderId, order.id)),
    ])

    for (const so of affected) {
      const [shopRecord] = await db
        .select({ ownerId: shop.ownerId })
        .from(shop)
        .where(eq(shop.id, so.shopId))
        .limit(1)
      if (shopRecord) {
        // `headline`/`body`/`actionUrl` feed the seller-alert email that
        // `NOTIFICATION_DELIVERY` now sends for this type. Localized here, where
        // the request locale is still in scope.
        await createNotification(shopRecord.ownerId, 'order_chargeback', {
          platformOrderId: order.id,
          shopOrderId: so.id,
          headline: m.notification_order_chargeback({ orderNumber: order.orderNumber }),
          body: m.email_chargeback_body(),
          actionUrl: `/studio/${so.shopId}/orders`,
        })
      }
    }
  })

  return { status: 'chargeback' }
}
