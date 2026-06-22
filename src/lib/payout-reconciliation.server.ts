import { and, eq, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { payout, payoutReconciliationLog, shopOrder } from '#/db/schema'
import { getMollieRoute } from '#/integrations/mollie'
import { getMollieApiKey, getMollieTestMode } from '#/lib/env.server'
import { logger } from '#/lib/logger.server'
import { executePayoutQuery } from './payouts.server'

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

export interface ReconciliationResult {
  checked: number
  reversed: number
  errors: number
}

interface MollieRefundList {
  refunds: Array<{
    id: string
    amount: { currency: string; value: string }
    status: string
  }>
}

/* -------------------------------------------------------------------------- */
/*                              Mollie helpers                                */
/* -------------------------------------------------------------------------- */

async function listMollieRefundsForPayment(paymentId: string): Promise<MollieRefundList> {
  const apiKey = getMollieApiKey()
  if (!apiKey) {
    throw new Error('MOLLIE_API_KEY is not set')
  }

  const query = getMollieTestMode() ? '?testmode=true' : ''
  const response = await fetch(
    `https://api.mollie.com/v2/payments/${encodeURIComponent(paymentId)}/refunds${query}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    },
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Mollie list refunds failed (${response.status}): ${body}`)
  }

  return (await response.json()) as MollieRefundList
}

function parseMollieAmountValue(value: string): number {
  const normalized = value.replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid Mollie amount value: ${value}`)
  }
  return Math.round(parsed * 100)
}

/**
 * Attribute Mollie refunds to a specific shop order by treating each refund as
 * belonging to this shop order while its amount fits within the remaining
 * unrefunded portion of that shop order. This prevents an unrelated refund on
 * the parent platform payment from reversing this shop order's payout.
 */
function attributeRefundsToShopOrder(
  refunds: MollieRefundList['refunds'],
  shopOrderTotalCents: number,
  alreadyRefundedCents: number,
): { attributedCents: number; attributedIds: string[] } {
  const sorted = [...refunds]
    .filter((r) => r.status === 'pending' || r.status === 'refunded' || r.status === 'queued')
    .map((r) => ({ id: r.id, cents: parseMollieAmountValue(r.amount.value) }))
    .sort((a, b) => a.cents - b.cents)

  let attributedCents = 0
  const attributedIds: string[] = []

  for (const refund of sorted) {
    const remaining = shopOrderTotalCents - alreadyRefundedCents - attributedCents
    if (remaining <= 0) break
    if (refund.cents <= remaining) {
      attributedCents += refund.cents
      attributedIds.push(refund.id)
    }
  }

  return { attributedCents, attributedIds }
}

/* -------------------------------------------------------------------------- */
/*                            Reconciliation                                  */
/* -------------------------------------------------------------------------- */

/**
 * Reconciles payout records against Mollie delayed-routing routes and refunds.
 *
 * - Marks payouts as `returned` when their route was returned by Mollie.
 * - Marks payouts as `reversed` when their route no longer exists or when a
 *   refund has been created for this shop order's portion of the parent payment.
 * - Emits reconciliation log entries for every state change.
 * - Logs alerts for unexpected discrepancies without mutating state.
 */
export async function reconcilePayouts(): Promise<ReconciliationResult> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const payoutsToCheck = await db
    .select({
      id: payout.id,
      shopOrderId: payout.shopOrderId,
      amountCents: payout.amountCents,
      molliePaymentId: payout.molliePaymentId,
      mollieRouteId: payout.mollieRouteId,
      status: payout.status,
      refundedCents: shopOrder.refundedCents,
      subtotalCents: shopOrder.subtotalCents,
      shippingCostCents: shopOrder.shippingCostCents,
    })
    .from(payout)
    .innerJoin(shopOrder, eq(payout.shopOrderId, shopOrder.id))
    .where(
      and(
        inArray(payout.status, ['sent', 'in_transit']),
        isNotNull(payout.molliePaymentId),
        isNotNull(payout.mollieRouteId),
        gte(payout.createdAt, since),
      ),
    )

  let reversed = 0
  let errors = 0

  for (const record of payoutsToCheck) {
    try {
      if (!record.molliePaymentId || !record.mollieRouteId) continue
      const paymentId = record.molliePaymentId
      const routeId = record.mollieRouteId
      const shopOrderTotalCents = record.subtotalCents + record.shippingCostCents

      const [route, refundList] = await Promise.all([
        getMollieRoute(paymentId, routeId),
        listMollieRefundsForPayment(paymentId),
      ])

      const routeReturned = route?.status === 'returned'
      const routeMissing = route === null

      if (routeReturned) {
        await db.transaction(async (tx) => {
          await tx
            .update(payout)
            .set({
              status: 'returned',
              returnedAt: new Date(),
              returnReason: 'mollie_route_returned',
            })
            .where(eq(payout.id, record.id))

          await tx.insert(payoutReconciliationLog).values({
            payoutId: record.id,
            event: 'route_returned',
            molliePaymentId: paymentId,
            mollieRouteId: routeId,
            amountCents: record.amountCents,
            payload: {
              routeStatus: route?.status,
            },
          })
        })

        reversed += 1
        logger.info(`Payout ${record.id} marked returned during reconciliation`, {
          payoutId: record.id,
          routeStatus: route?.status,
        })
        continue
      }

      const { attributedCents: refundAttributedCents, attributedIds: refundAttributedIds } =
        attributeRefundsToShopOrder(refundList.refunds, shopOrderTotalCents, record.refundedCents)

      const totalRefundedCents = record.refundedCents + refundAttributedCents
      const refundCoversPayout = totalRefundedCents >= record.amountCents

      if (routeMissing || refundCoversPayout) {
        const reason = routeMissing ? 'route_missing' : 'refund_detected'

        await db.transaction(async (tx) => {
          await tx
            .update(payout)
            .set({
              status: 'reversed',
              reversedAt: new Date(),
              reversalReason: reason,
            })
            .where(eq(payout.id, record.id))

          await tx.insert(payoutReconciliationLog).values({
            payoutId: record.id,
            event: reason,
            molliePaymentId: paymentId,
            mollieRouteId: routeId,
            amountCents: record.amountCents,
            payload: {
              routeMissing,
              refundCoversPayout,
              refundAttributedCents,
              refundAttributedIds,
              refundedCents: record.refundedCents,
            },
          })
        })

        reversed += 1
        logger.info(`Payout ${record.id} marked reversed during reconciliation`, {
          payoutId: record.id,
          routeMissing,
          refundCoversPayout,
          refundAttributedCents,
          refundAttributedIds,
        })
      }
    } catch (err) {
      errors += 1
      logger.error(`Payout reconciliation failed for ${record.id}`, err, {
        alert: true,
        payoutId: record.id,
        molliePaymentId: record.molliePaymentId,
        mollieRouteId: record.mollieRouteId,
      })
    }
  }

  return {
    checked: payoutsToCheck.length,
    reversed,
    errors,
  }
}

/**
 * Alerts on payouts that are still pending and approaching the 90-day Mollie
 * routing window. Does not mutate state.
 */
export async function alertOnStalePendingPayouts(): Promise<number> {
  const staleThreshold = new Date(Date.now() - 80 * 24 * 60 * 60 * 1000)

  const stalePayouts = await db
    .select({ id: payout.id, createdAt: payout.createdAt })
    .from(payout)
    .where(
      and(
        eq(payout.status, 'pending'),
        lte(payout.createdAt, staleThreshold),
        gte(payout.createdAt, sql`now() - interval '90 days'`),
      ),
    )

  for (const record of stalePayouts) {
    logger.error(`Payout ${record.id} is pending and approaching the 90-day routing window`, {
      alert: true,
      payoutId: record.id,
      createdAt: record.createdAt,
    })
  }

  return stalePayouts.length
}

/**
 * Releases payouts whose dispute windows have expired.
 *
 * Pending payouts attached to delivered/completed shop orders become eligible
 * for execution once the order's dispute window is over. This closes the
 * payout/dispute timing gap so sellers cannot be paid for orders that are
 * later disputed or refunded.
 */
export async function releaseHeldPayouts(): Promise<{
  checked: number
  released: number
  errors: number
}> {
  const heldPayouts = await db
    .select({
      id: payout.id,
      shopOrderId: payout.shopOrderId,
    })
    .from(payout)
    .innerJoin(shopOrder, eq(payout.shopOrderId, shopOrder.id))
    .where(
      and(
        eq(payout.status, 'pending'),
        inArray(shopOrder.status, ['delivered', 'completed']),
        lte(shopOrder.disputeWindowExpiresAt, sql`now()`),
      ),
    )

  let released = 0
  let errors = 0

  for (const record of heldPayouts) {
    try {
      await executePayoutQuery(record.id)
      released += 1
      logger.info(`Released held payout ${record.id} for shop order ${record.shopOrderId}`, {
        payoutId: record.id,
        shopOrderId: record.shopOrderId,
      })
    } catch (err) {
      errors += 1
      logger.error(`Failed to release held payout ${record.id}`, err, {
        alert: true,
        payoutId: record.id,
        shopOrderId: record.shopOrderId,
      })
    }
  }

  return { checked: heldPayouts.length, released, errors }
}
