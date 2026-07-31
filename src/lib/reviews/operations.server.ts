import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import {
  meilisearchSyncQueue,
  orderItem,
  platformOrder,
  product,
  review,
  reviewReport,
  shop,
  shopOrder,
  user,
} from '#/db/schema'
import { isPostgresUniqueViolation } from '../db-errors'
import { logger } from '../logger.server'
import { assertUserRateLimit } from '../rate-limit.server'
import { formatReviewerName } from './display-name'
import { PUBLIC_REVIEW_FILTER } from './visibility.server'
import { containsProfanity } from '../profanity'
import { sanitizeRichText } from '../xss'

/**
 * Approved-review totals drive a product's `popularityScore` in the search
 * index, so any change to them must be reflected there.
 *
 * Enqueued rather than synced inline: ranking freshness within one poll
 * interval is ample, and a Meilisearch outage must never fail a review write.
 */
async function enqueueSearchReindex(productId: string): Promise<void> {
  try {
    await db.insert(meilisearchSyncQueue).values({ productId, action: 'index' })
  } catch (err) {
    logger.error('Failed to enqueue product reindex after review change', err, { productId })
  }
}

import type {
  AdminReviewsResult,
  CreatedReview,
  ProductReviewsResult,
  ReviewableItem,
  ReviewDistribution,
  ReviewEligibilityResult,
  ReviewReportReason,
} from './types'

const ELIGIBILITY_DAYS = 14
const MS_PER_DAY = 24 * 60 * 60 * 1000

function getDaysRemaining(deliveredAt: Date | null): number | null {
  if (!deliveredAt) return null
  const eligibleDate = new Date(deliveredAt.getTime() + ELIGIBILITY_DAYS * MS_PER_DAY)
  const now = new Date()
  const diff = eligibleDate.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / MS_PER_DAY))
}

function isEligibleForReview(deliveredAt: Date | null): boolean {
  if (!deliveredAt) return false
  const eligibleDate = new Date(deliveredAt.getTime() + ELIGIBILITY_DAYS * MS_PER_DAY)
  return new Date() >= eligibleDate
}

export async function getReviewableItemsQuery(
  platformOrderId: string,
  userId: string,
): Promise<ReviewEligibilityResult | null> {
  const [order] = await db
    .select()
    .from(platformOrder)
    .where(eq(platformOrder.id, platformOrderId))
    .limit(1)

  if (!order || order.userId !== userId) {
    return null
  }

  const shopOrdersResult = await db
    .select()
    .from(shopOrder)
    .where(eq(shopOrder.platformOrderId, platformOrderId))

  const shopOrderIds = shopOrdersResult.map((so) => so.id)

  if (shopOrderIds.length === 0) {
    return { items: [] }
  }

  const [itemsResult, reviewsResult] = await Promise.all([
    db.select().from(orderItem).where(inArray(orderItem.shopOrderId, shopOrderIds)),
    db.select().from(review).where(inArray(review.shopOrderId, shopOrderIds)),
  ])

  const reviewMap = new Map<string, boolean>()
  for (const r of reviewsResult) {
    reviewMap.set(`${r.shopOrderId}-${r.productId}`, true)
  }

  const shopOrderMap = new Map(shopOrdersResult.map((so) => [so.id, so]))

  const items: ReviewableItem[] = itemsResult.map((item) => {
    const so = shopOrderMap.get(item.shopOrderId)
    const deliveredAt = so?.deliveredAt ?? null
    const eligible = isEligibleForReview(deliveredAt)
    return {
      shopOrderId: item.shopOrderId,
      productId: item.productId,
      productName: item.productName,
      deliveredAt,
      isEligible: eligible && so?.status === 'delivered',
      daysRemaining: eligible ? null : getDaysRemaining(deliveredAt),
      hasReview: reviewMap.get(`${item.shopOrderId}-${item.productId}`) ?? false,
    }
  })

  return { items }
}

export async function createReviewQuery(
  shopOrderId: string,
  productId: string,
  buyerUserId: string,
  rating: number,
  comment: string | null,
): Promise<CreatedReview> {
  await assertUserRateLimit(buyerUserId, 5, 15 * 60 * 1000)

  if (comment && containsProfanity(comment)) {
    throw new Response(
      JSON.stringify({
        error: 'Bad Request',
        message: 'Review contains inappropriate language',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const [shopOrderRecord] = await db
    .select()
    .from(shopOrder)
    .where(eq(shopOrder.id, shopOrderId))
    .limit(1)

  if (!shopOrderRecord) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Shop order not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const [platformOrderRecord] = await db
    .select()
    .from(platformOrder)
    .where(eq(platformOrder.id, shopOrderRecord.platformOrderId))
    .limit(1)

  if (!platformOrderRecord || platformOrderRecord.userId !== buyerUserId) {
    throw new Response(JSON.stringify({ error: 'Forbidden', message: 'Access denied' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const [shopRecord] = await db
    .select()
    .from(shop)
    .where(eq(shop.id, shopOrderRecord.shopId))
    .limit(1)

  if (shopRecord?.ownerId === buyerUserId) {
    throw new Response(
      JSON.stringify({ error: 'Forbidden', message: 'You cannot review your own product' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (shopOrderRecord.status !== 'delivered') {
    throw new Response(
      JSON.stringify({ error: 'Forbidden', message: 'Order must be delivered before reviewing' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (!shopOrderRecord.deliveredAt) {
    throw new Response(
      JSON.stringify({ error: 'Forbidden', message: 'Order must be delivered before reviewing' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const eligibleDate = new Date(
    shopOrderRecord.deliveredAt.getTime() + ELIGIBILITY_DAYS * MS_PER_DAY,
  )
  if (new Date() < eligibleDate) {
    const daysRemaining = getDaysRemaining(shopOrderRecord.deliveredAt)
    throw new Response(
      JSON.stringify({
        error: 'Forbidden',
        message: 'Review not yet eligible',
        daysRemaining,
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const existingReview = await db
    .select()
    .from(review)
    .where(and(eq(review.shopOrderId, shopOrderId), eq(review.productId, productId)))
    .limit(1)

  if (existingReview.length > 0) {
    throw new Response(
      JSON.stringify({ error: 'Conflict', message: 'Review already exists for this order item' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const sanitizedComment = sanitizeRichText(comment)

  let created: typeof review.$inferSelect
  try {
    const result = await db
      .insert(review)
      .values({
        shopOrderId,
        productId,
        buyerUserId,
        rating,
        comment: sanitizedComment,
      })
      .returning()
    created = result[0]
  } catch (err) {
    // Duplicate review race condition. Uses the helper rather than reading
    // `err.code` directly: drizzle wraps the driver error, so the property is
    // on `cause` and the inline check here never actually matched — a genuine
    // race surfaced as a 500. The pre-check above hid that in tests.
    if (isPostgresUniqueViolation(err, 'review_shop_order_product_unique')) {
      throw new Response(
        JSON.stringify({ error: 'Conflict', message: 'Review already exists for this order item' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }
    throw err
  }

  await enqueueSearchReindex(productId)

  // Notify seller after the review creation so errors don't break the transaction
  try {
    const [{ createNotification }, [shopRecord], [productRecord]] = await Promise.all([
      import('../notifications.server'),
      db.select().from(shop).where(eq(shop.id, shopOrderRecord.shopId)).limit(1),
      db.select().from(product).where(eq(product.id, productId)).limit(1),
    ])
    if (shopRecord) {
      await createNotification(shopRecord.ownerId, 'review_received', {
        shopOrderId,
        productId,
        reviewId: created.id,
        productName: productRecord?.name ?? '',
        productSlug: productRecord?.slug ?? '',
        shopSlug: shopRecord?.slug ?? '',
      })
    }
  } catch {
    // Notification errors must not break the primary review creation
  }

  return {
    id: created.id,
    shopOrderId: created.shopOrderId,
    productId: created.productId,
    rating: created.rating,
    comment: created.comment,
    createdAt: created.createdAt,
  }
}

export async function getProductReviewsQuery(
  productId: string,
  page: number,
  pageSize: number,
): Promise<ProductReviewsResult> {
  const validatedPageSize = Math.min(100, Math.max(1, pageSize))

  const [totalResult] = await db
    .select({ total: count() })
    .from(review)
    .where(and(eq(review.productId, productId), PUBLIC_REVIEW_FILTER))

  const total = totalResult?.total ?? 0
  const totalPages = Math.ceil(total / validatedPageSize)
  const validatedPage = totalPages > 0 ? Math.min(Math.max(1, page), totalPages) : Math.max(1, page)
  const offset = (validatedPage - 1) * validatedPageSize

  const [reviewsResult, [avgResult], distributionResult] = await Promise.all([
    db
      .select({
        id: review.id,
        buyerName: user.name,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        // C. consom. L.111-7-2 requires the date of the consumer's experience
        // alongside the date of publication. Delivery is that date here: it is
        // when the buyer first had the product, and it is what the review
        // eligibility window is measured from.
        experiencedAt: shopOrder.deliveredAt,
      })
      .from(review)
      .innerJoin(user, eq(review.buyerUserId, user.id))
      .innerJoin(shopOrder, eq(review.shopOrderId, shopOrder.id))
      .where(and(eq(review.productId, productId), PUBLIC_REVIEW_FILTER))
      .orderBy(desc(review.createdAt))
      .limit(validatedPageSize)
      .offset(offset),
    db
      .select({ average: sql<number | null>`round(avg(${review.rating})::numeric, 1)` })
      .from(review)
      .where(and(eq(review.productId, productId), PUBLIC_REVIEW_FILTER)),
    db
      .select({
        rating: review.rating,
        count: count(),
      })
      .from(review)
      .where(and(eq(review.productId, productId), PUBLIC_REVIEW_FILTER))
      .groupBy(review.rating),
  ])

  const distributionMap = new Map<number, number>()
  for (const d of distributionResult) {
    distributionMap.set(d.rating, Number(d.count))
  }

  const distribution: ReviewDistribution[] = []
  for (let i = 5; i >= 1; i--) {
    distribution.push({ rating: i, count: distributionMap.get(i) ?? 0 })
  }

  return {
    reviews: reviewsResult.map((r) => ({
      id: r.id,
      buyerName: formatReviewerName(r.buyerName),
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      experiencedAt: r.experiencedAt,
    })),
    total,
    averageRating: avgResult?.average != null ? Number(avgResult.average) : null,
    distribution,
    page: validatedPage,
    pageSize: validatedPageSize,
    totalPages: Math.ceil(total / validatedPageSize),
  }
}

/**
 * Records a notice about a review. **Deliberately changes no moderation state.**
 *
 * This used to set `flagged` on the first report from any signed-in user. Since
 * flagged reviews still display but are excluded from `popularityScore`, one
 * click moved a product's search ranking with nothing visible on the page —
 * report your own one-star reviews to rise, or a competitor's five-stars to sink
 * them. Recording the notice and leaving the decision to a human removes that
 * whole class rather than tuning a threshold.
 *
 * Reports are also what makes the DSA Article 17 statement of reasons possible:
 * a moderation decision can now cite the notice that prompted it, which
 * Article 17(3)(b) requires.
 */
export async function reportReviewQuery(
  reviewId: string,
  reporterUserId: string,
  reason: ReviewReportReason,
  details: string | null,
): Promise<{ alreadyReported: boolean }> {
  await assertUserRateLimit(reporterUserId, 10, 15 * 60 * 1000)

  const [reviewRecord] = await db.select().from(review).where(eq(review.id, reviewId)).limit(1)

  if (!reviewRecord) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Review not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (reviewRecord.buyerUserId === reporterUserId) {
    throw new Response(
      JSON.stringify({ error: 'Forbidden', message: 'You cannot report your own review' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const sanitizedDetails = details ? sanitizeRichText(details) : null

  try {
    await db.insert(reviewReport).values({
      reviewId,
      reporterUserId,
      reason,
      details: sanitizedDetails,
    })
  } catch (err) {
    // A second notice from the same person is not an error to them — the
    // unique index simply means it is already on record.
    if (isPostgresUniqueViolation(err, 'review_report_review_reporter_unique')) {
      return { alreadyReported: true }
    }
    throw err
  }

  return { alreadyReported: false }
}

/**
 * Open notices per review, for the moderation queue.
 *
 * Admins previously saw `flagged` with no record of who reported it or why,
 * because reporting wrote nothing down.
 */
export async function getReviewReportsQuery(reviewIds: string[]): Promise<Map<string, number>> {
  if (reviewIds.length === 0) return new Map()

  const rows = await db
    .select({ reviewId: reviewReport.reviewId, openReports: count() })
    .from(reviewReport)
    .where(and(inArray(reviewReport.reviewId, reviewIds), eq(reviewReport.status, 'open')))
    .groupBy(reviewReport.reviewId)

  return new Map(rows.map((row) => [row.reviewId, Number(row.openReports)]))
}

export async function getAdminReviewsQuery(
  status: 'all' | 'approved' | 'flagged' | 'hidden',
  page: number,
  pageSize: number,
): Promise<AdminReviewsResult> {
  const validatedPageSize = Math.min(100, Math.max(1, pageSize))

  const whereClause = status === 'all' ? undefined : eq(review.moderationStatus, status)

  const [totalResult] = await db.select({ total: count() }).from(review).where(whereClause)

  const total = totalResult?.total ?? 0
  const totalPages = Math.ceil(total / validatedPageSize)
  const validatedPage = totalPages > 0 ? Math.min(Math.max(1, page), totalPages) : Math.max(1, page)
  const offset = (validatedPage - 1) * validatedPageSize

  const reviewsResult = await db
    .select({
      id: review.id,
      productId: review.productId,
      productName: product.name,
      buyerName: user.name,
      rating: review.rating,
      comment: review.comment,
      moderationStatus: review.moderationStatus,
      createdAt: review.createdAt,
    })
    .from(review)
    .innerJoin(user, eq(review.buyerUserId, user.id))
    .innerJoin(product, eq(review.productId, product.id))
    .where(whereClause)
    .orderBy(desc(review.createdAt))
    .limit(validatedPageSize)
    .offset(offset)

  // One grouped query for the page, not one per row: the queue is paginated but
  // the page size goes to 100.
  const reportCounts = await getReviewReportsQuery(reviewsResult.map((r) => r.id))

  return {
    reviews: reviewsResult.map((r) => ({ ...r, openReports: reportCounts.get(r.id) ?? 0 })),
    total,
    page: validatedPage,
    pageSize: validatedPageSize,
    totalPages,
  }
}

/** Statuses that restrict what other people see, as opposed to restoring it. */
const RESTRICTING_STATUSES = new Set(['flagged', 'hidden'])

export interface ModerationDecision {
  /**
   * Whether the ground is the law or the terms. DSA Article 17(3)(d) and (e)
   * ask for different explanations, so the decision has to say which it is
   * rather than leaving the recipient to guess.
   */
  ground: 'illegal' | 'terms'
  /** The facts relied on, in the moderator's words — Article 17(3)(b). */
  explanation: string
  /** The admin deciding, recorded so the statement is not anonymous. */
  actorUserId: string
}

/**
 * Applies a moderation decision and tells the people entitled to know.
 *
 * DSA Article 17(1) requires a clear and specific statement of reasons to the
 * affected recipient for any restriction of the visibility of their content,
 * **including demotion** — and Article 19 exempts micro and small enterprises
 * from Section 3 (Articles 20–28) only, so Article 17 applies here at any size.
 * Until now this function wrote the new status and returned, telling nobody.
 *
 * Article 16(5) separately requires notifying whoever reported the content of
 * the decision and their redress options, which is why open reports are
 * resolved here rather than left dangling.
 */
export async function updateReviewModerationStatusQuery(
  reviewId: string,
  status: 'approved' | 'flagged' | 'hidden',
  decision: ModerationDecision,
): Promise<void> {
  const [reviewRecord] = await db.select().from(review).where(eq(review.id, reviewId)).limit(1)

  if (!reviewRecord) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Review not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const unchanged = reviewRecord.moderationStatus === status
  await db.update(review).set({ moderationStatus: status }).where(eq(review.id, reviewId))

  if (!unchanged) {
    // Moving in or out of `approved` changes the product's ranking signals.
    await enqueueSearchReindex(reviewRecord.productId)
  }

  const restricting = RESTRICTING_STATUSES.has(status)

  const openReports = await db
    .select({ id: reviewReport.id, reporterUserId: reviewReport.reporterUserId })
    .from(reviewReport)
    .where(and(eq(reviewReport.reviewId, reviewId), eq(reviewReport.status, 'open')))

  if (openReports.length > 0) {
    await db
      .update(reviewReport)
      .set({
        status: restricting ? 'upheld' : 'dismissed',
        resolvedAt: new Date(),
        resolvedByUserId: decision.actorUserId,
      })
      .where(and(eq(reviewReport.reviewId, reviewId), eq(reviewReport.status, 'open')))
  }

  // Notifications must not roll back a decision that is already recorded.
  try {
    const { createNotification } = await import('../notifications.server')

    if (!unchanged) {
      await createNotification(reviewRecord.buyerUserId, 'review_moderated', {
        reviewId,
        productId: reviewRecord.productId,
        // Article 17(3)(a): what was done, where it applies, for how long.
        restriction: status,
        territorialScope: 'all',
        duration: 'indefinite',
        // (b): the facts, and whether a notice prompted the decision.
        explanation: decision.explanation,
        promptedByNotice: openReports.length > 0,
        // (c): no automated moderation exists — reports no longer change state
        // on their own, and only an admin can reach this function.
        automatedMeans: false,
        // (d) / (e): which ground, so the recipient can contest the right one.
        ground: decision.ground,
        // (f): redress. Out-of-court dispute settlement under Article 21 is a
        // Section 3 obligation we are exempt from, so it is deliberately not
        // offered here — the routes named are the ones that exist.
        redress: ['contact_support', 'judicial_remedy'],
      })
    }

    for (const report of openReports) {
      await createNotification(report.reporterUserId, 'review_report_resolved', {
        reviewId,
        outcome: restricting ? 'upheld' : 'dismissed',
        redress: ['contact_support', 'judicial_remedy'],
      })
    }
  } catch (err) {
    // Logged rather than swallowed: a missing statement of reasons is a
    // compliance failure, not a cosmetic one, and needs to be visible.
    logger.error('Failed to send review moderation notifications', err, { reviewId, status })
  }
}
