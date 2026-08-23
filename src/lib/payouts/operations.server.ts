import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { payout, payoutReconciliationLog, platformOrder, shop, shopOrder } from '#/db/schema'
import { createMollieRoute } from '#/integrations/mollie'
import { disconnectMollieConnect } from '../mollie-connect.server'
import type { AuditActor } from '../audit-logger'
import { logger } from '../logger.server'
import { m } from '#/paraglide/messages'
import { PLATFORM_FEE_PERCENT } from '../platform-constants'
import { isValidPayoutTransition, PayoutError } from './lifecycle'
import type { PayoutStatus } from './lifecycle'
import type { ExecutePayoutResult, PayoutReversalOptions } from './types'

/* -------------------------------------------------------------------------- */
/*                         Suspension Release Guard                            */
/* -------------------------------------------------------------------------- */

// Buyer protection wins over seller payout: flows that move money BACK toward
// buyers or the platform (refunds, dispute resolutions, order cancellations,
// reconciliation reversals) deliberately do NOT go through this guard and stay
// available while a shop is suspended. Only seller-ward movement is gated.
//
// Suspension propagation contract: while `shop.isSuspended` is true, payouts
// for that shop must not be scheduled, released, or sent; they remain (or are
// created) held in `pending`. The ledger row is still written by
// createPayoutForShopOrder so unsuspension restores normal flow without manual
// data fixes — the next natural transition succeeds.

/**
 * Single shared gate for every code path that moves a payout forward toward a
 * seller. Throws {@link PayoutError} with code `SHOP_SUSPENDED` when the shop
 * is suspended; unknown shops are denied as well (fail closed).
 *
 * Takes the shop row FOR UPDATE inside the caller's transaction so release
 * decisions serialize against concurrent suspend/unsuspend updates.
 */
export async function assertPayoutReleaseAllowed(
  tx: Omit<typeof db, '$client'>,
  shopId: string,
): Promise<void> {
  const [record] = await tx
    .select({ isSuspended: shop.isSuspended })
    .from(shop)
    .where(eq(shop.id, shopId))
    .for('update')
    .limit(1)

  if (!record || record.isSuspended) {
    throw new PayoutError('SHOP_SUSPENDED', `Payout release blocked: shop ${shopId} is suspended`)
  }
}

/* -------------------------------------------------------------------------- */
/*                        Create Payout for Shop Order                         */
/* -------------------------------------------------------------------------- */

/**
 * Idempotently inserts a pending payout record for a shop order.
 * Uses ON CONFLICT DO NOTHING so duplicate calls are safe.
 *
 * Suspension: the row is intentionally still created (held at `pending`) for
 * suspended shops so unsuspension restores the normal release flow without
 * manual data fixes; forward movement is blocked by
 * {@link assertPayoutReleaseAllowed}.
 *
 * Returns the id of the inserted or existing payout row.
 */
export async function createPayoutForShopOrder(
  tx: Omit<typeof db, '$client'>,
  shopOrderId: string,
  shopId: string,
  subtotalCents: number,
  vatAmountCents: number,
  shippingCostCents: number,
  shippingMethod: 'standard' | 'express' | 'manual',
): Promise<string | undefined> {
  const netSubtotalCents = subtotalCents - vatAmountCents
  const feeCents = Math.round(netSubtotalCents * (PLATFORM_FEE_PERCENT / 100))
  let amountCents = subtotalCents - feeCents

  if (shippingMethod === 'manual') {
    amountCents += shippingCostCents
  }

  const [existing] = await tx
    .select({ id: payout.id })
    .from(payout)
    .where(eq(payout.shopOrderId, shopOrderId))
    .limit(1)

  if (existing) {
    return existing.id
  }

  const [created] = await tx
    .insert(payout)
    .values({
      shopOrderId,
      shopId,
      amountCents,
      status: 'pending',
      createdAt: new Date(),
    })
    .returning({ id: payout.id })

  return created?.id
}

/**
 * Reverses (or partially claws back) a routed payout for a refund.
 *
 * Not gated by shop suspension: refunds claw money back to the buyer, and
 * buyer protection wins over seller payout.
 *
 * - If the refund amount covers the full payout, the payout is marked
 *   `reversed` and `reverseRouting: true` is returned for the Mollie refund.
 * - If the refund is partial, the payout record is left as-is and a partial
 *   routing reversal is returned so Mollie can claw back only the refunded
 *   portion from the seller.
 * - If no routed payout exists or the shop has no Mollie account, an empty
 *   options object is returned.
 */
export async function reversePayoutForRefund(
  tx: Omit<typeof db, '$client'>,
  shopOrderId: string,
  refundCents: number,
  reason: string,
): Promise<PayoutReversalOptions> {
  const [payoutRecord] = await tx
    .select()
    .from(payout)
    .where(eq(payout.shopOrderId, shopOrderId))
    .for('update')
    .limit(1)

  if (!payoutRecord) {
    return {}
  }

  if (!['sent', 'in_transit'].includes(payoutRecord.status)) {
    return {}
  }

  const [shopRecord] = await tx
    .select({ mollieAccountId: shop.mollieAccountId })
    .from(shop)
    .where(eq(shop.id, payoutRecord.shopId))
    .limit(1)

  const sellerMollieAccountId = shopRecord?.mollieAccountId
  if (!sellerMollieAccountId) {
    return {}
  }

  if (refundCents >= payoutRecord.amountCents) {
    if (!isValidPayoutTransition(payoutRecord.status as PayoutStatus, 'reversed')) {
      throw new PayoutError(
        'INVALID_STATUS_TRANSITION',
        `Cannot transition payout ${payoutRecord.id} from '${payoutRecord.status}' to 'reversed'`,
      )
    }
    await tx
      .update(payout)
      .set({
        status: 'reversed',
        reversedAt: new Date(),
        reversalReason: reason,
      })
      .where(eq(payout.id, payoutRecord.id))

    return { reverseRouting: true }
  }

  // Partial refund: do not mark the full payout as reversed. Mollie will
  // claw back only the refunded portion from the seller's routed share.
  return {
    routingReversals: [
      {
        organizationId: sellerMollieAccountId,
        amountCents: Math.min(refundCents, payoutRecord.amountCents),
      },
    ],
  }
}

/* -------------------------------------------------------------------------- */
/*                          Reconciliation Log                                 */
/* -------------------------------------------------------------------------- */

async function insertPayoutReconciliationLog(
  tx: Omit<typeof db, '$client'>,
  input: {
    payoutId: string
    event: string
    molliePaymentId?: string | null
    mollieRouteId?: string | null
    amountCents?: number
    payload?: Record<string, unknown>
  },
): Promise<void> {
  await tx.insert(payoutReconciliationLog).values({
    payoutId: input.payoutId,
    event: input.event,
    molliePaymentId: input.molliePaymentId ?? null,
    mollieRouteId: input.mollieRouteId ?? null,
    amountCents: input.amountCents ?? null,
    payload: input.payload ?? {},
  })
}

/* -------------------------------------------------------------------------- */
/*                          Execute Payout                                     */
/* -------------------------------------------------------------------------- */

/**
 * Executes a payout by creating a Mollie delayed-routing route from the platform
 * payment to the seller's connected Mollie organization.
 *
 * Idempotent:
 * - If the payout is already `sent`, returns the existing route ID without side effects.
 * - If the payout is `failed`, retries the route creation.
 * - If the payout is `reversed`, returns an error (reversed payouts cannot be re-executed).
 * - If the shop is suspended, the payout stays held `pending`: nothing executes.
 */
export async function executePayoutQuery(payoutId: string): Promise<ExecutePayoutResult> {
  const txResult = await db.transaction(async (tx) => {
    const [payoutRecord] = await tx
      .select()
      .from(payout)
      .where(eq(payout.id, payoutId))
      .for('update')
      .limit(1)

    if (!payoutRecord) {
      return { kind: 'error' as const, status: 404, message: 'Payout not found' }
    }

    if (payoutRecord.status === 'sent') {
      return { kind: 'success' as const, routeId: payoutRecord.mollieRouteId ?? undefined }
    }

    if (payoutRecord.status === 'reversed') {
      return {
        kind: 'error' as const,
        status: 409,
        message: 'Payout has been reversed and cannot be re-executed',
      }
    }

    if (payoutRecord.status === 'returned') {
      return {
        kind: 'error' as const,
        status: 409,
        message: 'Payout has been returned and cannot be re-executed',
      }
    }

    if (!['pending', 'failed', 'in_transit'].includes(payoutRecord.status)) {
      return {
        kind: 'error' as const,
        status: 409,
        message: `Payout cannot be executed from status '${payoutRecord.status}'`,
      }
    }

    // Suspension propagation: a suspended shop's payout stays held pending —
    // no route is created and no status changes. Checked inside this
    // transaction via the shared guard so admin executions, API executions,
    // and the release sweep all serialize against suspend/unsuspend.
    try {
      await assertPayoutReleaseAllowed(tx, payoutRecord.shopId)
    } catch (err) {
      if (err instanceof PayoutError && err.code === 'SHOP_SUSPENDED') {
        return { kind: 'error' as const, status: 409, message: err.message }
      }
      throw err
    }

    // Load the related order and shop to obtain Mollie IDs.
    if (!payoutRecord.shopOrderId) {
      const reason = 'Payout has no associated shop order'
      await tx
        .update(payout)
        .set({ status: 'failed', failedAt: new Date(), failureReason: reason })
        .where(eq(payout.id, payoutId))
      await insertPayoutReconciliationLog(tx, {
        payoutId,
        event: 'route_failed',
        amountCents: payoutRecord.amountCents,
        payload: { reason },
      })
      return { kind: 'error' as const, status: 412, message: reason }
    }

    const [orderRecord] = await tx
      .select({
        platformOrderId: shopOrder.platformOrderId,
        status: shopOrder.status,
        disputeWindowExpiresAt: shopOrder.disputeWindowExpiresAt,
      })
      .from(shopOrder)
      .where(eq(shopOrder.id, payoutRecord.shopOrderId))
      .limit(1)

    if (orderRecord) {
      if (!['delivered', 'completed'].includes(orderRecord.status)) {
        const reason = `Payout cannot be executed while shop order status is '${orderRecord.status}'`
        return { kind: 'error' as const, status: 409, message: reason }
      }

      if (
        orderRecord.disputeWindowExpiresAt &&
        new Date(orderRecord.disputeWindowExpiresAt) > new Date()
      ) {
        const reason = 'Dispute window has not expired'
        return { kind: 'error' as const, status: 409, message: reason }
      }
    }

    const [platformOrderRecord] = orderRecord?.platformOrderId
      ? await tx
          .select({ molliePaymentId: platformOrder.molliePaymentId })
          .from(platformOrder)
          .where(eq(platformOrder.id, orderRecord.platformOrderId))
          .limit(1)
      : [null]

    const [shopRecord] = await tx
      .select({
        ownerId: shop.ownerId,
        mollieAccountId: shop.mollieAccountId,
        paymentConnected: shop.paymentConnected,
      })
      .from(shop)
      .where(eq(shop.id, payoutRecord.shopId))
      .limit(1)

    const molliePaymentId = platformOrderRecord?.molliePaymentId
    const mollieAccountId = shopRecord?.mollieAccountId

    if (!molliePaymentId) {
      const reason = 'Platform order has no Mollie payment ID'
      await tx
        .update(payout)
        .set({ status: 'failed', failedAt: new Date(), failureReason: reason })
        .where(eq(payout.id, payoutId))
      await insertPayoutReconciliationLog(tx, {
        payoutId,
        event: 'route_failed',
        amountCents: payoutRecord.amountCents,
        payload: { reason },
      })
      return { kind: 'error' as const, status: 412, message: reason }
    }

    if (!mollieAccountId || !shopRecord?.paymentConnected) {
      const reason = 'Shop has no connected Mollie account'
      await tx
        .update(payout)
        .set({ status: 'failed', failedAt: new Date(), failureReason: reason })
        .where(eq(payout.id, payoutId))
      await insertPayoutReconciliationLog(tx, {
        payoutId,
        event: 'route_failed',
        molliePaymentId,
        amountCents: payoutRecord.amountCents,
        payload: { reason, paymentConnected: shopRecord?.paymentConnected ?? false },
      })
      return { kind: 'error' as const, status: 412, message: reason }
    }

    // Mark in_transit before the external call so concurrent callers see it.
    await tx
      .update(payout)
      .set({ status: 'in_transit', molliePaymentId })
      .where(eq(payout.id, payoutId))

    let route: { id: string }
    try {
      route = await createMollieRoute({
        paymentId: molliePaymentId,
        amountCents: payoutRecord.amountCents,
        currency: 'EUR',
        destinationOrganizationId: mollieAccountId,
        description: `Eurtisan payout for order ${payoutRecord.shopOrderId}`,
      })
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Mollie route creation failed'
      if (!isValidPayoutTransition('in_transit', 'failed')) {
        throw new PayoutError(
          'INVALID_STATUS_TRANSITION',
          `Cannot transition payout ${payoutId} from 'in_transit' to 'failed'`,
        )
      }
      await tx
        .update(payout)
        .set({ status: 'failed', failedAt: new Date(), failureReason: reason })
        .where(eq(payout.id, payoutId))
      await insertPayoutReconciliationLog(tx, {
        payoutId,
        event: 'route_failed',
        molliePaymentId,
        amountCents: payoutRecord.amountCents,
        payload: { reason: reason },
      })
      return { kind: 'error' as const, status: 502, message: reason }
    }

    if (!isValidPayoutTransition('in_transit', 'sent')) {
      throw new PayoutError(
        'INVALID_STATUS_TRANSITION',
        `Cannot transition payout ${payoutId} from 'in_transit' to 'sent'`,
      )
    }
    await tx
      .update(payout)
      .set({
        status: 'sent',
        molliePaymentId,
        mollieRouteId: route.id,
        sentAt: new Date(),
        executedAt: new Date(),
      })
      .where(eq(payout.id, payoutId))

    await insertPayoutReconciliationLog(tx, {
      payoutId,
      event: 'route_created',
      molliePaymentId,
      mollieRouteId: route.id,
      amountCents: payoutRecord.amountCents,
      payload: { destinationOrganizationId: mollieAccountId },
    })

    // Create notification — errors must not break the payout transaction
    try {
      const { createNotification } = await import('../notifications.server')
      if (shopRecord.ownerId) {
        const amount = String(payoutRecord.amountCents / 100)
        await createNotification(shopRecord.ownerId, 'payout_sent', {
          payoutId,
          shopId: payoutRecord.shopId,
          amount,
          // Feeds the seller-alert email; see `NOTIFICATION_DELIVERY`.
          headline: m.notification_payout_sent({ amount }),
          body: m.email_payout_body(),
          actionUrl: `/studio/${payoutRecord.shopId}`,
        })
      }
    } catch (notifyErr) {
      logger.error('Failed to send payout_sent notification', notifyErr, {
        alert: true,
        payoutId,
        shopId: payoutRecord.shopId,
      })
    }

    return { kind: 'success' as const, routeId: route.id }
  })

  if (txResult.kind === 'error') {
    throw new Response(
      JSON.stringify({ error: getErrorCodeForStatus(txResult.status), message: txResult.message }),
      {
        status: txResult.status,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  return { success: true, routeId: txResult.routeId }
}

function getErrorCodeForStatus(status: number): string {
  switch (status) {
    case 404:
      return 'Not Found'
    case 409:
      return 'Conflict'
    case 412:
      return 'Precondition Failed'
    case 502:
      return 'Bad Gateway'
    default:
      return 'Internal Server Error'
  }
}

/**
 * @deprecated Use {@link executePayoutQuery} instead. This alias exists only to
 * ease migration of existing callers and tests.
 */
export async function markPayoutSentQuery(payoutId: string): Promise<{ success: boolean }> {
  const result = await executePayoutQuery(payoutId)
  return { success: result.success }
}

/**
 * Disconnects a shop's connected Mollie account.
 */
export async function disconnectMollieQuery(
  shopId: string,
  actor: AuditActor,
): Promise<{ success: boolean }> {
  await disconnectMollieConnect({ shopId, actor })
  return { success: true }
}
