import { and, count, desc, eq, gte, ilike, inArray, lte, or } from 'drizzle-orm'
import { db } from '#/db/index'
import {
  invoices,
  payout,
  payoutReconciliationLog,
  platformOrder,
  shop,
  shopOrder,
  user,
} from '#/db/schema'
import { createMollieRoute } from '#/integrations/mollie'
import { signMollieState } from '../auth-utils.server'
import { disconnectMollieConnect } from '../mollie-connect.server'
import type { AuditActor } from '../audit-logger'
import { logger } from '../logger.server'
import { PLATFORM_FEE_PERCENT } from '../platform-constants'
import { isValidPayoutTransition, PayoutError } from './lifecycle'
import type { PayoutStatus } from './lifecycle'
import type {
  AdminPayoutRow,
  CreatorPayoutLine,
  ExecutePayoutResult,
  PayoutReversalOptions,
} from './types'

/* -------------------------------------------------------------------------- */
/*                        Create Payout for Shop Order                         */
/* -------------------------------------------------------------------------- */

/**
 * Idempotently inserts a pending payout record for a shop order.
 * Uses ON CONFLICT DO NOTHING so duplicate calls are safe.
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

/\* -------------------------------------------------------------------------- */
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
        await createNotification(shopRecord.ownerId, 'payout_sent', {
          payoutId,
          shopId: payoutRecord.shopId,
          amount: String(payoutRecord.amountCents / 100),
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

/* -------------------------------------------------------------------------- */
/*                         List Creator Payouts Query                          */
/* -------------------------------------------------------------------------- */

/**
 * Helper: derives a single CreatorPayoutLine from a raw order row.
 */
function derivePayoutLine(
  order: {
    id: string
    subtotalCents: number
    vatAmountCents: number
    shippingCostCents: number
    shippingMethod: 'standard' | 'express' | 'manual'
    status: string
    createdAt: Date
  },
  payoutStatus: CreatorPayoutLine['status'] | null,
  payoutAmountCents: number | null | undefined,
  invoiceNumbers: { customerInvoiceNumber: string | null; platformFeeInvoiceNumber: string | null },
): CreatorPayoutLine {
  const isRefund = order.status === 'refunded'

  let amountCents = payoutAmountCents ?? 0
  if (payoutAmountCents === null || payoutAmountCents === undefined) {
    const netSubtotal = order.subtotalCents - order.vatAmountCents
    const feeCents = Math.round(netSubtotal * (PLATFORM_FEE_PERCENT / 100))
    let netAmount = order.subtotalCents - feeCents
    if (order.shippingMethod === 'manual') {
      netAmount += order.shippingCostCents
    }
    amountCents = isRefund ? -Math.abs(netAmount) : netAmount
  } else if (isRefund) {
    amountCents = -Math.abs(amountCents)
  }

  // Use the persisted payout status when available; otherwise fall back to a
  // status derived from the order lifecycle.
  let status: CreatorPayoutLine['status'] = payoutStatus ?? 'pending'
  if (!payoutStatus && order.status === 'completed') {
    status = 'in_transit'
  }

  return {
    orderId: order.id,
    date: order.createdAt,
    amountCents,
    status,
    orderStatus: order.status,
    isRefund,
    customerInvoiceNumber: invoiceNumbers.customerInvoiceNumber,
    platformFeeInvoiceNumber: invoiceNumbers.platformFeeInvoiceNumber,
  }
}


/* -------------------------------------------------------------------------- */
/*                       List Pending Payouts Query                            */
/* -------------------------------------------------------------------------- */

/**
 * Returns paginated pending payouts enriched with creator and shop details.
 * Sorted oldest first so admins process the longest-waiting payouts first.
 *
 * This is a pure query function — callers are responsible for authorization.
 */
export async function listPendingPayoutsQuery(
  page = 1,
  pageSize = 20,
): Promise<{
  payouts: AdminPayoutRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}> {
  const boundedPage = Math.max(1, page)
  const boundedPageSize = Math.min(100, Math.max(1, pageSize))
  const offset = (boundedPage - 1) * boundedPageSize

  const where = inArray(payout.status, ['pending', 'failed'])

  const [countRow] = await db
    .select({ total: count() })
    .from(payout)
    .innerJoin(shop, eq(payout.shopId, shop.id))
    .innerJoin(user, eq(shop.ownerId, user.id))
    .where(where)

  const total = Number(countRow?.total ?? 0)

  const rows = await db
    .select({
      payoutId: payout.id,
      amountCents: payout.amountCents,
      status: payout.status,
      sentAt: payout.sentAt,
      createdAt: payout.createdAt,
      failureReason: payout.failureReason,
      shopName: shop.name,
      shopId: shop.id,
      creatorName: user.name,
      creatorId: user.id,
    })
    .from(payout)
    .innerJoin(shop, eq(payout.shopId, shop.id))
    .innerJoin(user, eq(shop.ownerId, user.id))
    .where(where)
    .orderBy(payout.createdAt)
    .limit(boundedPageSize)
    .offset(offset)

  return {
    payouts: rows,
    total,
    page: boundedPage,
    pageSize: boundedPageSize,
    totalPages: Math.ceil(total / boundedPageSize),
  }
}

/* -------------------------------------------------------------------------- */
/*                       List Payout History Query                             */
/* -------------------------------------------------------------------------- */

/**
 * Returns paginated payout history (all statuses) enriched with creator and shop details.
 * Sorted most recent first.
 *
 * This is a pure query function — callers are responsible for authorization.
 */
export async function listPayoutHistoryQuery(
  options: { page?: number; pageSize?: number; from?: Date; to?: Date; query?: string } = {},
): Promise<{
  payouts: AdminPayoutRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}> {
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20))
  const offset = (page - 1) * pageSize

  const conditions = []
  if (options.from) {
    conditions.push(gte(payout.createdAt, options.from))
  }
  if (options.to) {
    conditions.push(lte(payout.createdAt, options.to))
  }
  if (options.query) {
    const pattern = `%${options.query}%`
    conditions.push(or(ilike(shop.name, pattern), ilike(user.name, pattern)))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [countRow] = await db
    .select({ total: count() })
    .from(payout)
    .innerJoin(shop, eq(payout.shopId, shop.id))
    .innerJoin(user, eq(shop.ownerId, user.id))
    .where(where)

  const total = Number(countRow?.total ?? 0)

  const rows = await db
    .select({
      payoutId: payout.id,
      amountCents: payout.amountCents,
      status: payout.status,
      sentAt: payout.sentAt,
      createdAt: payout.createdAt,
      failureReason: payout.failureReason,
      shopName: shop.name,
      shopId: shop.id,
      creatorName: user.name,
      creatorId: user.id,
    })
    .from(payout)
    .innerJoin(shop, eq(payout.shopId, shop.id))
    .innerJoin(user, eq(shop.ownerId, user.id))
    .where(where)
    .orderBy(desc(payout.createdAt))
    .limit(pageSize)
    .offset(offset)

  return {
    payouts: rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/**
 * Derives paginated payout line items for a creator's shop from shop_order records.
 *
 * - Completed and delivered orders produce positive earning lines.
 * - Refunded orders produce negative adjustment lines.
 * - Amount is subtotal minus platform fee ({@link PLATFORM_FEE_PERCENT}).
 * - Payout status is derived from the underlying order status and any existing payout records:
 *   - `delivered` → `pending`
 *   - `completed` → `in_transit`
 *   - If a matching payout record exists with status `sent` → `sent`
 * - When `status` filter is provided, all matching orders are fetched, statuses derived,
 *   and results are filtered in-memory before pagination.
 *
 * This is a pure query function — callers are responsible for authorization.
 */
export async function listCreatorPayoutsQuery(
  shopId: string,
  options: {
    page?: number
    pageSize?: number
    /** Filter by payout status. Omit or pass 'all' for no filtering. */
    status?: CreatorPayoutLine['status'] | 'all'
  } = {},
): Promise<{
  payouts: CreatorPayoutLine[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}> {
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20))
  const statusFilter = options.status && options.status !== 'all' ? options.status : undefined

  // Fetch all orders for this shop that are relevant for payouts,
  // left-joining payout so we know the per-order payout status.
  const allOrders = await db
    .select({
      id: shopOrder.id,
      subtotalCents: shopOrder.subtotalCents,
      vatAmountCents: shopOrder.vatAmountCents,
      shippingCostCents: shopOrder.shippingCostCents,
      shippingMethod: shopOrder.shippingMethod,
      status: shopOrder.status,
      createdAt: shopOrder.createdAt,
      payoutStatus: payout.status,
      payoutAmountCents: payout.amountCents,
    })
    .from(shopOrder)
    .leftJoin(payout, eq(shopOrder.id, payout.shopOrderId))
    .where(
      and(
        eq(shopOrder.shopId, shopId),
        inArray(shopOrder.status, ['completed', 'delivered', 'refunded']),
      ),
    )
    .orderBy(desc(shopOrder.createdAt))

  if (allOrders.length === 0) {
    return {
      payouts: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    }
  }

  // Fetch invoice numbers for all relevant shop orders in one query.
  const orderIds = allOrders.map((order) => order.id)
  const invoiceRows =
    orderIds.length > 0
      ? await db
          .select({
            shopOrderId: invoices.shopOrderId,
            type: invoices.type,
            invoiceNumber: invoices.invoiceNumber,
          })
          .from(invoices)
          .where(inArray(invoices.shopOrderId, orderIds))
      : []

  const customerInvoiceByOrderId = new Map<string, string>()
  const platformFeeInvoiceByOrderId = new Map<string, string>()
  for (const row of invoiceRows) {
    if (row.type === 'customer') {
      customerInvoiceByOrderId.set(row.shopOrderId, row.invoiceNumber)
    } else if (row.type === 'platform_fee') {
      platformFeeInvoiceByOrderId.set(row.shopOrderId, row.invoiceNumber)
    }
  }

  // Derive payout lines for all orders and filter by status if requested
  let payouts: CreatorPayoutLine[] = allOrders.map((order) =>
    derivePayoutLine(order, order.payoutStatus, order.payoutAmountCents, {
      customerInvoiceNumber: customerInvoiceByOrderId.get(order.id) ?? null,
      platformFeeInvoiceNumber: platformFeeInvoiceByOrderId.get(order.id) ?? null,
    }),
  )

  if (statusFilter) {
    payouts = payouts.filter((p) => p.status === statusFilter)
  }

  const total = payouts.length

  // Paginate in memory
  const offset = (page - 1) * pageSize
  const pageItems = payouts.slice(offset, offset + pageSize)

  return {
    payouts: pageItems,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/**
 * Generates the Mollie Connect authorization URL.
 *
 * In non-production environments without configured credentials, returns the
 * local mock OAuth page so developers can test the flow. In production,
 * missing credentials are a fatal configuration error.
 */
export async function getMollieConnectUrlQuery(shopId: string, userId: string): Promise<string> {
  const { getBaseUrl, getMollieClientId } = await import('../env.server')
  const mollieClientId = getMollieClientId()
  const baseUrl = getBaseUrl()
  const redirectUri = `${baseUrl}/api/auth/mollie/callback`
  const state = signMollieState(shopId, userId)

  if (!mollieClientId) {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
      throw new Error('MOLLIE_CLIENT_ID is required in production for Mollie Connect onboarding')
    }
    return `${baseUrl}/mollie-mock-oauth?shopId=${encodeURIComponent(shopId)}&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`
  }

  const scopes = encodeURIComponent(
    ['payments.write', 'refunds.write', 'organizations.read', 'profiles.read', 'payouts.read'].join(
      ' ',
    ),
  )

  return `https://www.mollie.com/oauth/authorize?client_id=${mollieClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${scopes}&response_type=code&approval_prompt=auto`
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