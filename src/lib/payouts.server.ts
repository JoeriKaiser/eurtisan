import { and, count, desc, eq, gte, ilike, inArray, lte, or } from 'drizzle-orm'
import { db } from '#/db/index'
import { payout, shop, shopOrder, user } from '#/db/schema'
export const PLATFORM_FEE_PERCENT = 10

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

/**
 * A derived payout line item computed from a shop_order record.
 * Represents a single earning (or negative adjustment) for the creator.
 */
export interface CreatorPayoutLine {
  orderId: string
  date: Date
  amountCents: number
  /** Payout lifecycle status derived from the underlying order and any payout records. */
  status: 'pending' | 'processing' | 'sent'
  /** Original shop_order status, exposed so the UI can differentiate refunds. */
  orderStatus: string
  /** True when this line represents a refund deduction. */
  isRefund: boolean
}

/* -------------------------------------------------------------------------- */
/*                          Mark Payout Sent (existing)                        */
/* -------------------------------------------------------------------------- */

export async function markPayoutSentQuery(payoutId: string): Promise<{ success: boolean }> {
  return db.transaction(async (tx) => {
    const [payoutRecord] = await tx.select().from(payout).where(eq(payout.id, payoutId)).limit(1)

    if (!payoutRecord) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Payout not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (payoutRecord.status === 'sent') {
      return { success: true }
    }

    await tx
      .update(payout)
      .set({ status: 'sent', sentAt: new Date() })
      .where(eq(payout.id, payoutId))

    const shopRecord = await tx.select().from(shop).where(eq(shop.id, payoutRecord.shopId)).limit(1)

    // Create notification — errors must not break the payout transaction
    try {
      const { createNotification } = await import('./notifications.server')
      if (shopRecord[0]) {
        await createNotification(shopRecord[0].ownerId, 'payout_sent', {
          payoutId,
          shopId: payoutRecord.shopId,
          amount: String(payoutRecord.amountCents / 100),
        })
      }
    } catch {
      // swallow
    }

    return { success: true }
  })
}

/* -------------------------------------------------------------------------- */
/*                         List Creator Payouts Query                          */
/* -------------------------------------------------------------------------- */

/**
 * Helper: derives a single CreatorPayoutLine from a raw order row.
 */
function derivePayoutLine(
  order: { id: string; subtotalCents: number; status: string; createdAt: Date },
  hasSentPayout: boolean,
): CreatorPayoutLine {
  const isRefund = order.status === 'refunded'

  // Compute the creator's cut: subtotal minus platform fee.
  const feeCents = Math.round(order.subtotalCents * (PLATFORM_FEE_PERCENT / 100))
  const netAmount = order.subtotalCents - feeCents
  const amountCents = isRefund ? -Math.abs(netAmount) : netAmount

  // Derive payout status from the underlying order status and any payout records
  let payoutStatus: CreatorPayoutLine['status'] = 'pending'
  if (isRefund) {
    // Refunds are adjustments — status is not meaningful; use 'processing' as neutral default
    payoutStatus = 'processing'
  } else if (order.status === 'completed') {
    payoutStatus = hasSentPayout ? 'sent' : 'processing'
  } else if (order.status === 'delivered') {
    payoutStatus = hasSentPayout ? 'sent' : 'pending'
  }

  return {
    orderId: order.id,
    date: order.createdAt,
    amountCents,
    status: payoutStatus,
    orderStatus: order.status,
    isRefund,
  }
}

/* -------------------------------------------------------------------------- */
/*                       Admin Payout Row Type                                 */
/* -------------------------------------------------------------------------- */

/**
 * A payout record enriched with creator and shop details for the admin oversight view.
 */
export interface AdminPayoutRow {
  payoutId: string
  amountCents: number
  status: 'pending' | 'sent'
  sentAt: Date | null
  createdAt: Date
  shopName: string
  shopId: string
  creatorName: string
  creatorId: string
}

/* -------------------------------------------------------------------------- */
/*                       List Pending Payouts Query                            */
/* -------------------------------------------------------------------------- */

/**
 * Returns all pending payouts enriched with creator and shop details.
 * Sorted oldest first so admins process the longest-waiting payouts first.
 *
 * This is a pure query function — callers are responsible for authorization.
 */
export async function listPendingPayoutsQuery(): Promise<AdminPayoutRow[]> {
  const rows = await db
    .select({
      payoutId: payout.id,
      amountCents: payout.amountCents,
      status: payout.status,
      sentAt: payout.sentAt,
      createdAt: payout.createdAt,
      shopName: shop.name,
      shopId: shop.id,
      creatorName: user.name,
      creatorId: user.id,
    })
    .from(payout)
    .innerJoin(shop, eq(payout.shopId, shop.id))
    .innerJoin(user, eq(shop.ownerId, user.id))
    .where(eq(payout.status, 'pending'))
    .orderBy(payout.createdAt)

  return rows
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
 *   - `completed` → `processing`
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
    /** Filter by derived payout status. Omit or pass 'all' for no filtering. */
    status?: 'pending' | 'processing' | 'sent' | 'all'
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

  // Fetch all orders for this shop that are relevant for payouts
  const allOrders = await db
    .select({
      id: shopOrder.id,
      subtotalCents: shopOrder.subtotalCents,
      status: shopOrder.status,
      createdAt: shopOrder.createdAt,
    })
    .from(shopOrder)
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

  // Fetch existing payout records for this shop to determine which orders have been paid out.
  const [sentPayout] = await db
    .select({ id: payout.id })
    .from(payout)
    .where(and(eq(payout.shopId, shopId), eq(payout.status, 'sent')))
    .limit(1)

  const hasSentPayout = !!sentPayout

  // Derive payout lines for all orders and filter by status if requested
  let payouts: CreatorPayoutLine[] = allOrders.map((order) =>
    derivePayoutLine(order, hasSentPayout),
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
 * Generates the Mollie Connect authorization URL or a local mock OAuth page redirect if keys are not set.
 */
export async function getMollieConnectUrlQuery(shopId: string): Promise<string> {
  const mollieClientId = process.env.MOLLIE_CLIENT_ID
  const { getBaseUrl } = await import('./env.server')
  const baseUrl = getBaseUrl()
  const redirectUri = `${baseUrl}/api/auth/mollie/callback`
  const state = shopId

  if (!mollieClientId) {
    return `${baseUrl}/mollie-mock-oauth?shopId=${encodeURIComponent(shopId)}&redirect_uri=${encodeURIComponent(redirectUri)}`
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
export async function disconnectMollieQuery(shopId: string): Promise<{ success: boolean }> {
  await db
    .update(shop)
    .set({
      mollieAccountId: null,
      paymentConnected: false,
      paymentConnectedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(shop.id, shopId))

  return { success: true }
}
