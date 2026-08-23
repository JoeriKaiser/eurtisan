import { and, count, desc, eq, gte, ilike, inArray, lte, or } from 'drizzle-orm'
import { db } from '#/db/index'
import { invoices, payout, shop, shopOrder, user } from '#/db/schema'
import { signMollieState } from '../auth-utils.server'
import { PLATFORM_FEE_PERCENT } from '../platform-constants'
import type { AdminPayoutRow, CreatorPayoutLine } from './types'

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
