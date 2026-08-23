import { and, count, eq, inArray, sql } from 'drizzle-orm'
import { unionAll } from 'drizzle-orm/pg-core'

import { db } from '#/db/index'
import { product, productReport, shop, shopReport, user } from '#/db/schema'
import { requireRoleForUser } from '../authz'
import { isPostgresUniqueViolation } from '../db-errors'
import { assertUserRateLimit } from '../rate-limit.server'
import type { SafeUser } from '../server-auth'
import { sanitizeRichText } from '../xss'
import type {
  AdminListingReport,
  AdminListingReportsResult,
  CreateListingReportResult,
  ListingReportReason,
  ListingReportStatus,
  ListingReportTargetType,
} from './types'

/** Matches the notice rate applied to review reports. */
const REPORT_RATE_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 }

/**
 * Records a DSA Art. 16 notice against a product listing.
 *
 * Ownership-independent by design: any authenticated user may report any
 * listing, including a competitor's or — as here — their own shop's.
 * Gatekeeping who may file a notice would trade a legal reporting route for a
 * politeness rule; abuse is handled by the rate limit and admin triage
 * instead. Like `reportReviewQuery`, recording a notice changes nothing about
 * the product's visibility or search standing — only an admin decision does.
 */
export async function createProductReportQuery(
  productId: string,
  reporterUserId: string,
  reason: ListingReportReason,
  details: string | null,
): Promise<CreateListingReportResult> {
  await assertUserRateLimit(reporterUserId, REPORT_RATE_LIMIT.limit, REPORT_RATE_LIMIT.windowMs)

  const [productRecord] = await db
    .select({ id: product.id })
    .from(product)
    .where(eq(product.id, productId))
    .limit(1)

  if (!productRecord) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Product not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await db.insert(productReport).values({
      productId,
      reporterUserId,
      reason,
      details: sanitizeRichText(details),
    })
  } catch (err) {
    // A second notice from the same person is not an error to them — the
    // unique index simply means it is already on record.
    if (isPostgresUniqueViolation(err, 'product_report_product_reporter_unique')) {
      return { alreadyReported: true }
    }
    throw err
  }

  return { alreadyReported: false }
}

/** The shop-level counterpart of `createProductReportQuery`. */
export async function createShopReportQuery(
  shopId: string,
  reporterUserId: string,
  reason: ListingReportReason,
  details: string | null,
): Promise<CreateListingReportResult> {
  await assertUserRateLimit(reporterUserId, REPORT_RATE_LIMIT.limit, REPORT_RATE_LIMIT.windowMs)

  const [shopRecord] = await db
    .select({ id: shop.id })
    .from(shop)
    .where(eq(shop.id, shopId))
    .limit(1)

  if (!shopRecord) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await db.insert(shopReport).values({
      shopId,
      reporterUserId,
      reason,
      details: sanitizeRichText(details),
    })
  } catch (err) {
    if (isPostgresUniqueViolation(err, 'shop_report_shop_reporter_unique')) {
      return { alreadyReported: true }
    }
    throw err
  }

  return { alreadyReported: false }
}

/**
 * The merged admin triage queue for listing and shop notices, newest first.
 *
 * Product and shop notices live in two tables but are triaged as one queue —
 * an admin should not have to watch two lists to know whether anything was
 * reported today. A single `UNION ALL` keeps global ordering and pagination
 * correct in one round trip; both branches share the reason/status enums and
 * project the same shape, with `targetType` discriminating rows.
 *
 * Authorization note: the role gate lives here rather than only in the server
 * function, so `requireRoleForUser('admin')` guards every path that reaches
 * the data — including future internal callers — and can be tested directly
 * without the RPC machinery.
 */
export async function getAdminListingReportsQuery(
  actor: SafeUser,
  status: 'all' | ListingReportStatus,
  page: number,
  pageSize: number,
): Promise<AdminListingReportsResult> {
  requireRoleForUser('admin', actor)

  const validatedPageSize = Math.min(100, Math.max(1, pageSize))

  const statusFilter = status === 'all' ? null : [status]

  const [[productTotal], [shopTotal]] = await Promise.all([
    db
      .select({ total: count() })
      .from(productReport)
      .where(statusFilter ? inArray(productReport.status, statusFilter) : undefined),
    db
      .select({ total: count() })
      .from(shopReport)
      .where(statusFilter ? inArray(shopReport.status, statusFilter) : undefined),
  ])

  const total = Number(productTotal.total) + Number(shopTotal.total)
  const totalPages = Math.ceil(total / validatedPageSize)
  const validatedPage = totalPages > 0 ? Math.min(Math.max(1, page), totalPages) : Math.max(1, page)
  const offset = (validatedPage - 1) * validatedPageSize

  // Each branch projects the identical shape; `targetType` is a literal per
  // branch so merged rows stay self-describing.
  const productBranch = db
    .select({
      targetType: sql<ListingReportTargetType>`'product'`,
      id: productReport.id,
      targetId: productReport.productId,
      targetName: product.name,
      shopId: product.shopId,
      shopName: shop.name,
      reporterName: user.name,
      reason: productReport.reason,
      details: productReport.details,
      status: productReport.status,
      resolutionNote: productReport.resolutionNote,
      createdAt: productReport.createdAt,
      resolvedAt: productReport.resolvedAt,
    })
    .from(productReport)
    .innerJoin(user, eq(user.id, productReport.reporterUserId))
    .innerJoin(product, eq(product.id, productReport.productId))
    .innerJoin(shop, eq(shop.id, product.shopId))
    .where(statusFilter ? inArray(productReport.status, statusFilter) : undefined)

  const shopBranch = db
    .select({
      targetType: sql<ListingReportTargetType>`'shop'`,
      id: shopReport.id,
      targetId: shopReport.shopId,
      targetName: shop.name,
      shopId: shop.id,
      shopName: shop.name,
      reporterName: user.name,
      reason: shopReport.reason,
      details: shopReport.details,
      status: shopReport.status,
      resolutionNote: shopReport.resolutionNote,
      createdAt: shopReport.createdAt,
      resolvedAt: shopReport.resolvedAt,
    })
    .from(shopReport)
    .innerJoin(user, eq(user.id, shopReport.reporterUserId))
    .innerJoin(shop, eq(shop.id, shopReport.shopId))
    .where(statusFilter ? inArray(shopReport.status, statusFilter) : undefined)

  const rows = await unionAll(productBranch, shopBranch)
    // Both branches project a physical `created_at`, so the bare output
    // column is a valid ORDER BY target for the UNION.
    .orderBy(sql`created_at desc`)
    .limit(validatedPageSize)
    .offset(offset)

  return {
    // Branch shapes are kept field-identical on purpose; the assertion is the
    // compile-time contract that they have not drifted apart.
    reports: rows as AdminListingReport[],
    total,
    page: validatedPage,
    pageSize: validatedPageSize,
    totalPages,
  }
}

export interface ResolveListingReportInput {
  reportId: string
  targetType: ListingReportTargetType
  outcome: Extract<ListingReportStatus, 'actioned' | 'dismissed'>
  note: string
}

/**
 * Closes a notice with a recorded decision: who decided, when, what was done,
 * and why — the audit trail the notice-and-action procedure has to leave
 * behind. A final decision is immutable: re-deciding would silently rewrite
 * the record, so an already-closed report answers 409 instead.
 *
 * The note is stored sanitized like other moderator-entered rich text; an
 * empty one is rejected because a decision without its grounds cannot be
 * audited.
 */
export async function resolveListingReportQuery(
  actor: SafeUser,
  input: ResolveListingReportInput,
): Promise<void> {
  requireRoleForUser('admin', actor)

  const resolutionNote = sanitizeRichText(input.note)
  if (!resolutionNote) {
    throw new Response(
      JSON.stringify({ error: 'Bad Request', message: 'A resolution note is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const resolvedValues = {
    status: input.outcome,
    resolutionNote,
    resolvedAt: new Date(),
    resolvedByUserId: actor.id,
  }
  // Only open or merely-reviewed reports may move; the status guard keeps a
  // final decision from being overwritten by a later call.
  let updatedIds: Array<{ id: string }>
  if (input.targetType === 'product') {
    updatedIds = await db
      .update(productReport)
      .set(resolvedValues)
      .where(
        and(
          eq(productReport.id, input.reportId),
          inArray(productReport.status, ['open', 'reviewed']),
        ),
      )
      .returning({ id: productReport.id })
  } else {
    updatedIds = await db
      .update(shopReport)
      .set(resolvedValues)
      .where(
        and(eq(shopReport.id, input.reportId), inArray(shopReport.status, ['open', 'reviewed'])),
      )
      .returning({ id: shopReport.id })
  }

  if (updatedIds.length === 0) {
    const table = input.targetType === 'product' ? productReport : shopReport
    const [existing] = await db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.id, input.reportId))
      .limit(1)

    if (!existing) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Report not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    throw new Response(
      JSON.stringify({ error: 'Conflict', message: 'This report is already resolved' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
