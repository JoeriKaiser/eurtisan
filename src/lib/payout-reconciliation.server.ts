import { and, eq, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { payout, payoutReconciliationLog } from '#/db/schema'
import { getMollieRoute } from '#/integrations/mollie'
import { getMollieApiKey, getMollieTestMode } from '#/lib/env.server'
import { logger } from '#/lib/logger.server'

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

/* -------------------------------------------------------------------------- */
/*                            Reconciliation                                  */
/* -------------------------------------------------------------------------- */

/**
 * Reconciles payout records against Mollie delayed-routing routes and refunds.
 *
 * - Marks payouts as `reversed` when their route no longer exists or when a
 *   refund has been created for the parent payment.
 * - Emits reconciliation log entries for every state change.
 * - Logs alerts for unexpected discrepancies without mutating state.
 */
export async function reconcilePayouts(): Promise<ReconciliationResult> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const payoutsToCheck = await db
    .select({
      id: payout.id,
      amountCents: payout.amountCents,
      molliePaymentId: payout.molliePaymentId,
      mollieRouteId: payout.mollieRouteId,
      status: payout.status,
    })
    .from(payout)
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
      const paymentId = record.molliePaymentId!
      const routeId = record.mollieRouteId!

      const [route, refundList] = await Promise.all([
        getMollieRoute(paymentId, routeId),
        listMollieRefundsForPayment(paymentId).catch(() => ({ refunds: [] })),
      ])

      const hasRefund = refundList.refunds.length > 0
      const routeMissing = route === null

      if (routeMissing || hasRefund) {
        await db.transaction(async (tx) => {
          await tx
            .update(payout)
            .set({
              status: 'reversed',
              reversedAt: new Date(),
              reversalReason: routeMissing ? 'route_missing' : 'refund_detected',
            })
            .where(eq(payout.id, record.id))

          await tx.insert(payoutReconciliationLog).values({
            payoutId: record.id,
            event: routeMissing ? 'route_missing' : 'refund_detected',
            molliePaymentId: paymentId,
            mollieRouteId: routeId,
            amountCents: record.amountCents,
            payload: {
              routeMissing,
              refundCount: refundList.refunds.length,
            },
          })
        })

        reversed += 1
        logger.info(`Payout ${record.id} marked reversed during reconciliation`, {
          payoutId: record.id,
          routeMissing,
          refundCount: refundList.refunds.length,
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
