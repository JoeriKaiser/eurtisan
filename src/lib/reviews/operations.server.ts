import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '#/db/index'
import {
  meilisearchSyncQueue,
  orderItem,
  platformOrder,
  product,
  review,
  reviewReport,
  reviewHelpfulVote,
  sellerReply,
  sellerReplyReport,
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
import { sanitizeRichText, validatePlainText } from '../xss'

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
  AdminSellerRepliesResult,
  AdminReviewsResult,
  CreatedReview,
  ProductReviewsResult,
  ReviewableItem,
  ReviewDistribution,
  ReviewEligibilityResult,
  ReviewReportReason,
  ReviewSort,
  SellerReplyModerationDecision,
} from './types'
const sellerReplyAuthor = alias(user, 'seller_reply_author')
const sellerReplyReviewBuyer = alias(user, 'seller_reply_review_buyer')

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

function getProductReviewOrder(sort: ReviewSort, helpfulCount: ReturnType<typeof sql>) {
  switch (sort) {
    case 'highest':
      return [desc(review.rating), desc(review.createdAt), desc(review.id)]
    case 'lowest':
      return [asc(review.rating), desc(review.createdAt), desc(review.id)]
    case 'helpful':
      return [desc(helpfulCount), desc(review.createdAt), desc(review.id)]
    case 'newest':
      return [desc(review.createdAt), desc(review.id)]
  }
}

export async function getProductReviewsQuery(
  productId: string,
  page: number,
  pageSize: number,
  sort: ReviewSort = 'newest',
  rating?: number,
  viewerUserId?: string,
): Promise<ProductReviewsResult> {
  const validatedPageSize = Math.min(100, Math.max(1, pageSize))
  const ratingFilter = rating ?? null
  const reviewFilter = and(
    eq(review.productId, productId),
    PUBLIC_REVIEW_FILTER,
    ratingFilter === null ? undefined : eq(review.rating, ratingFilter),
  )
  // Totals, average, and the histogram all use this same predicate, so a
  // selected rating describes the entire result rather than only its page.
  const helpfulCount = sql<number>`(select count(*) from ${reviewHelpfulVote} where ${reviewHelpfulVote.reviewId} = ${review.id})`
  const viewerHasMarkedHelpful = viewerUserId
    ? sql<boolean>`exists(select 1 from ${reviewHelpfulVote} where ${reviewHelpfulVote.reviewId} = ${review.id} and ${reviewHelpfulVote.userId} = ${viewerUserId})`
    : sql<boolean>`false`
  const hasSellerReply = sql<boolean>`exists(select 1 from ${sellerReply} where ${sellerReply.reviewId} = ${review.id})`

  const [totalResult] = await db.select({ total: count() }).from(review).where(reviewFilter)
  const total = totalResult?.total ?? 0
  const totalPages = Math.ceil(total / validatedPageSize)
  const validatedPage = totalPages > 0 ? Math.min(Math.max(1, page), totalPages) : Math.max(1, page)
  const offset = (validatedPage - 1) * validatedPageSize

  const [reviewsResult, [avgResult], distributionResult] = await Promise.all([
    db
      .select({
        id: review.id,
        buyerUserId: review.buyerUserId,
        buyerName: user.name,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        experiencedAt: shopOrder.deliveredAt,
        helpfulCount,
        viewerHasMarkedHelpful,
        hasSellerReply,
        productStatus: product.status,
        productIsActive: product.isActive,
        shopOwnerId: shop.ownerId,
        shopStatus: shop.status,
        shopIsSuspended: shop.isSuspended,
        sellerReplyId: sellerReply.id,
        sellerReplyAuthorUserId: sellerReply.authorUserId,
        sellerReplyBody: sellerReply.body,
        sellerReplyCreatedAt: sellerReply.createdAt,
        sellerReplyUpdatedAt: sellerReply.updatedAt,
        sellerName: shop.name,
      })
      .from(review)
      .innerJoin(user, eq(review.buyerUserId, user.id))
      .innerJoin(shopOrder, eq(review.shopOrderId, shopOrder.id))
      .innerJoin(product, eq(review.productId, product.id))
      .innerJoin(shop, eq(product.shopId, shop.id))
      .leftJoin(
        sellerReply,
        and(eq(sellerReply.reviewId, review.id), eq(sellerReply.moderationStatus, 'approved')),
      )
      .where(reviewFilter)
      .orderBy(...getProductReviewOrder(sort, helpfulCount))
      .limit(validatedPageSize)
      .offset(offset),
    db
      .select({ average: sql<number | null>`round(avg(${review.rating})::numeric, 1)` })
      .from(review)
      .where(reviewFilter),
    db
      .select({
        rating: review.rating,
        count: count(),
      })
      .from(review)
      .where(reviewFilter)
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
    reviews: reviewsResult.map((r) => {
      const isPublicContent =
        r.productStatus === 'published' &&
        r.productIsActive &&
        r.shopStatus === 'active' &&
        !r.shopIsSuspended
      const publicSellerReply =
        r.sellerReplyId &&
        r.sellerReplyBody !== null &&
        r.sellerReplyCreatedAt !== null &&
        r.sellerReplyUpdatedAt !== null
          ? {
              id: r.sellerReplyId,
              body: r.sellerReplyBody,
              sellerName: r.sellerName ?? '',
              createdAt: r.sellerReplyCreatedAt,
              updatedAt: r.sellerReplyUpdatedAt,
              canManage: viewerUserId === r.shopOwnerId,
              canReport: !!viewerUserId && viewerUserId !== r.sellerReplyAuthorUserId,
            }
          : null
      return {
        id: r.id,
        buyerName: formatReviewerName(r.buyerName),
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        experiencedAt: r.experiencedAt,
        helpfulCount: Number(r.helpfulCount),
        viewerHasMarkedHelpful: r.viewerHasMarkedHelpful,
        canMarkHelpful:
          !!viewerUserId &&
          isPublicContent &&
          viewerUserId !== r.buyerUserId &&
          viewerUserId !== r.shopOwnerId,
        canReply:
          !!viewerUserId && viewerUserId === r.shopOwnerId && isPublicContent && !r.hasSellerReply,
        sellerReply: publicSellerReply,
      }
    }),
    total,
    averageRating: avgResult?.average != null ? Number(avgResult.average) : null,
    distribution,
    page: validatedPage,
    pageSize: validatedPageSize,
    totalPages,
    sort,
    ratingFilter,
  }
}

export async function setReviewHelpfulQuery(
  reviewId: string,
  voterUserId: string,
  helpful: boolean,
): Promise<{ helpfulCount: number; viewerHasMarkedHelpful: boolean }> {
  const [reviewRecord] = await db
    .select({
      id: review.id,
      buyerUserId: review.buyerUserId,
      shopOwnerId: shop.ownerId,
      productStatus: product.status,
      productIsActive: product.isActive,
      shopStatus: shop.status,
      shopIsSuspended: shop.isSuspended,
      moderationStatus: review.moderationStatus,
    })
    .from(review)
    .innerJoin(product, eq(review.productId, product.id))
    .innerJoin(shop, eq(product.shopId, shop.id))
    .where(eq(review.id, reviewId))
    .limit(1)

  if (!reviewRecord) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Review not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (reviewRecord.buyerUserId === voterUserId || reviewRecord.shopOwnerId === voterUserId) {
    throw new Response(
      JSON.stringify({ error: 'Forbidden', message: 'You cannot mark this review helpful' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const isPublicContent =
    reviewRecord.moderationStatus === 'approved' &&
    reviewRecord.productStatus === 'published' &&
    reviewRecord.productIsActive &&
    reviewRecord.shopStatus === 'active' &&
    !reviewRecord.shopIsSuspended

  if (helpful && !isPublicContent) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Review not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (helpful) {
    await db
      .insert(reviewHelpfulVote)
      .values({ reviewId, userId: voterUserId })
      .onConflictDoNothing()
  } else {
    await db
      .delete(reviewHelpfulVote)
      .where(
        and(eq(reviewHelpfulVote.reviewId, reviewId), eq(reviewHelpfulVote.userId, voterUserId)),
      )
  }

  const [[totalResult], [viewerVote]] = await Promise.all([
    db
      .select({ total: count() })
      .from(reviewHelpfulVote)
      .where(eq(reviewHelpfulVote.reviewId, reviewId)),
    db
      .select({ reviewId: reviewHelpfulVote.reviewId })
      .from(reviewHelpfulVote)
      .where(
        and(eq(reviewHelpfulVote.reviewId, reviewId), eq(reviewHelpfulVote.userId, voterUserId)),
      )
      .limit(1),
  ])

  return {
    helpfulCount: Number(totalResult?.total ?? 0),
    viewerHasMarkedHelpful: !!viewerVote,
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

function replyBadRequest(message: string): never {
  throw new Response(JSON.stringify({ error: 'Bad Request', message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sellerReplyNotFound(): never {
  throw new Response(JSON.stringify({ error: 'Not Found', message: 'Seller reply not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sellerReplyForbidden(message: string): never {
  throw new Response(JSON.stringify({ error: 'Forbidden', message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}

function validateSellerReplyBody(body: string): string {
  const plainBody = validatePlainText(body, 'Seller reply')
  if (plainBody.length === 0 || plainBody.length > 2000) {
    replyBadRequest('Seller reply must be between 1 and 2000 characters')
  }
  return plainBody
}

async function getReviewSellerContext(reviewId: string) {
  const [context] = await db
    .select({
      reviewId: review.id,
      reviewStatus: review.moderationStatus,
      reviewAuthorUserId: review.buyerUserId,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      shopSlug: shop.slug,
      shopOwnerId: shop.ownerId,
      shopStatus: shop.status,
      shopSuspended: shop.isSuspended,
    })
    .from(review)
    .innerJoin(shopOrder, eq(review.shopOrderId, shopOrder.id))
    .innerJoin(shop, eq(shopOrder.shopId, shop.id))
    .innerJoin(product, eq(review.productId, product.id))
    .where(eq(review.id, reviewId))
    .limit(1)
  return context
}

async function getSellerReplyContext(replyId: string) {
  const [context] = await db
    .select({
      replyId: sellerReply.id,
      replyAuthorUserId: sellerReply.authorUserId,
      replyStatus: sellerReply.moderationStatus,
      reviewId: review.id,
      reviewStatus: review.moderationStatus,
      reviewAuthorUserId: review.buyerUserId,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      shopSlug: shop.slug,
      shopOwnerId: shop.ownerId,
      shopStatus: shop.status,
      shopSuspended: shop.isSuspended,
    })
    .from(sellerReply)
    .innerJoin(review, eq(sellerReply.reviewId, review.id))
    .innerJoin(shopOrder, eq(review.shopOrderId, shopOrder.id))
    .innerJoin(shop, eq(shopOrder.shopId, shop.id))
    .innerJoin(product, eq(review.productId, product.id))
    .where(eq(sellerReply.id, replyId))
    .limit(1)
  return context
}

function assertCurrentShopOwner(
  context: Awaited<ReturnType<typeof getReviewSellerContext>>,
  sellerUserId: string,
  requireActiveShop: boolean,
): asserts context {
  if (!context || context.shopOwnerId !== sellerUserId) {
    sellerReplyForbidden('Current shop ownership is required')
  }
  if (
    requireActiveShop &&
    (context.shopStatus !== 'active' ||
      context.shopSuspended ||
      context.reviewStatus !== 'approved')
  ) {
    sellerReplyForbidden('An active, unsuspended shop may reply only to approved reviews')
  }
}

export async function createSellerReplyQuery(reviewId: string, sellerUserId: string, body: string) {
  const replyBody = validateSellerReplyBody(body)
  const context = await getReviewSellerContext(reviewId)
  if (!context) {
    throw new Response(JSON.stringify({ error: 'Not Found', message: 'Review not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  assertCurrentShopOwner(context, sellerUserId, true)

  let created: typeof sellerReply.$inferSelect
  try {
    ;[created] = await db
      .insert(sellerReply)
      .values({ reviewId, authorUserId: sellerUserId, body: replyBody })
      .returning()
  } catch (err) {
    if (isPostgresUniqueViolation(err, 'seller_reply_review_unique')) {
      throw new Response(
        JSON.stringify({ error: 'Conflict', message: 'A seller reply already exists' }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
    throw err
  }

  try {
    const { createNotification } = await import('../notifications.server')
    await createNotification(context.reviewAuthorUserId, 'seller_reply_received', {
      contentType: 'seller_reply',
      replyId: created.id,
      reviewId,
      productId: context.productId,
      productName: context.productName,
      productSlug: context.productSlug,
      shopSlug: context.shopSlug,
    })
  } catch (err) {
    logger.error('Failed to send seller reply creation notification', err, {
      replyId: created.id,
      reviewId,
    })
  }
  return created
}

export async function updateSellerReplyQuery(replyId: string, sellerUserId: string, body: string) {
  const replyBody = validateSellerReplyBody(body)
  const context = await getSellerReplyContext(replyId)
  if (!context) sellerReplyNotFound()
  assertCurrentShopOwner(context, sellerUserId, true)
  const [updated] = await db
    .update(sellerReply)
    .set({ body: replyBody, updatedAt: new Date() })
    .where(eq(sellerReply.id, replyId))
    .returning()
  if (!updated) sellerReplyNotFound()
  return updated
}

export async function deleteSellerReplyQuery(replyId: string, sellerUserId: string): Promise<void> {
  const context = await getSellerReplyContext(replyId)
  if (!context) sellerReplyNotFound()
  assertCurrentShopOwner(context, sellerUserId, false)
  const deleted = await db.delete(sellerReply).where(eq(sellerReply.id, replyId)).returning({
    id: sellerReply.id,
  })
  if (deleted.length === 0) sellerReplyNotFound()
}

export async function reportSellerReplyQuery(
  replyId: string,
  reporterUserId: string,
  reason: ReviewReportReason,
  details: string | null,
): Promise<{ alreadyReported: boolean }> {
  await assertUserRateLimit(reporterUserId, 10, 15 * 60 * 1000)
  const context = await getSellerReplyContext(replyId)
  if (!context) sellerReplyNotFound()
  if (context.replyAuthorUserId === reporterUserId) {
    sellerReplyForbidden('You cannot report your own seller reply')
  }
  try {
    await db.insert(sellerReplyReport).values({
      sellerReplyId: replyId,
      reporterUserId,
      reason,
      details: details ? sanitizeRichText(details) : null,
    })
  } catch (err) {
    if (isPostgresUniqueViolation(err, 'seller_reply_report_reply_reporter_unique')) {
      return { alreadyReported: true }
    }
    throw err
  }
  return { alreadyReported: false }
}

export async function getSellerReplyReportsQuery(replyIds: string[]): Promise<Map<string, number>> {
  if (replyIds.length === 0) return new Map()
  const rows = await db
    .select({ replyId: sellerReplyReport.sellerReplyId, openReports: count() })
    .from(sellerReplyReport)
    .where(
      and(inArray(sellerReplyReport.sellerReplyId, replyIds), eq(sellerReplyReport.status, 'open')),
    )
    .groupBy(sellerReplyReport.sellerReplyId)
  return new Map(rows.map((row) => [row.replyId, Number(row.openReports)]))
}

export async function getAdminSellerRepliesQuery(
  status: 'all' | 'approved' | 'flagged' | 'hidden',
  page: number,
  pageSize: number,
): Promise<AdminSellerRepliesResult> {
  const validatedPageSize = Math.min(100, Math.max(1, pageSize))
  const whereClause = status === 'all' ? undefined : eq(sellerReply.moderationStatus, status)
  const [totalResult] = await db.select({ total: count() }).from(sellerReply).where(whereClause)
  const total = totalResult?.total ?? 0
  const totalPages = Math.ceil(total / validatedPageSize)
  const validatedPage = totalPages > 0 ? Math.min(Math.max(1, page), totalPages) : Math.max(1, page)
  const offset = (validatedPage - 1) * validatedPageSize

  const replies = await db
    .select({
      id: sellerReply.id,
      reviewId: review.id,
      reviewRating: review.rating,
      reviewComment: review.comment,
      buyerName: sellerReplyReviewBuyer.name,
      productId: product.id,
      productName: product.name,
      shopName: shop.name,
      shopSlug: shop.slug,
      sellerName: sellerReplyAuthor.name,
      body: sellerReply.body,
      moderationStatus: sellerReply.moderationStatus,
      createdAt: sellerReply.createdAt,
      updatedAt: sellerReply.updatedAt,
    })
    .from(sellerReply)
    .innerJoin(review, eq(sellerReply.reviewId, review.id))
    .innerJoin(product, eq(review.productId, product.id))
    .innerJoin(shopOrder, eq(review.shopOrderId, shopOrder.id))
    .innerJoin(shop, eq(shopOrder.shopId, shop.id))
    .innerJoin(sellerReplyAuthor, eq(sellerReply.authorUserId, sellerReplyAuthor.id))
    .innerJoin(sellerReplyReviewBuyer, eq(review.buyerUserId, sellerReplyReviewBuyer.id))
    .where(whereClause)
    .orderBy(desc(sellerReply.createdAt), desc(sellerReply.id))
    .limit(validatedPageSize)
    .offset(offset)

  const reportCounts = await getSellerReplyReportsQuery(replies.map((reply) => reply.id))
  return {
    sellerReplies: replies.map((reply) => ({
      ...reply,
      openReports: reportCounts.get(reply.id) ?? 0,
    })),
    total,
    page: validatedPage,
    pageSize: validatedPageSize,
    totalPages,
  }
}

export async function updateSellerReplyModerationStatusQuery(
  replyId: string,
  status: 'approved' | 'flagged' | 'hidden',
  decision: SellerReplyModerationDecision,
): Promise<void> {
  const context = await getSellerReplyContext(replyId)
  if (!context) sellerReplyNotFound()

  const unchanged = context.replyStatus === status
  await db
    .update(sellerReply)
    .set({ moderationStatus: status, updatedAt: new Date() })
    .where(eq(sellerReply.id, replyId))

  const restricting = RESTRICTING_STATUSES.has(status)
  const openReports = await db
    .select({
      reporterUserId: sellerReplyReport.reporterUserId,
      reason: sellerReplyReport.reason,
      details: sellerReplyReport.details,
    })
    .from(sellerReplyReport)
    .where(and(eq(sellerReplyReport.sellerReplyId, replyId), eq(sellerReplyReport.status, 'open')))

  if (openReports.length > 0) {
    await db
      .update(sellerReplyReport)
      .set({
        status: restricting ? 'upheld' : 'dismissed',
        resolvedAt: new Date(),
        resolvedByUserId: decision.actorUserId,
      })
      .where(
        and(eq(sellerReplyReport.sellerReplyId, replyId), eq(sellerReplyReport.status, 'open')),
      )
  }

  try {
    const { createNotification } = await import('../notifications.server')
    const content = {
      contentType: 'seller_reply',
      replyId,
      reviewId: context.reviewId,
      productId: context.productId,
      productName: context.productName,
      productSlug: context.productSlug,
      shopSlug: context.shopSlug,
    } as const

    if (!unchanged) {
      await createNotification(context.replyAuthorUserId, 'seller_reply_moderated', {
        ...content,
        restriction: status,
        territorialScope: 'all',
        duration: 'indefinite',
        ground: decision.ground,
        legalBasis: decision.legalBasis,
        explanation: decision.explanation,
        promptedByNotice: openReports.length > 0,
        automatedMeans: false,
        redress: ['contact_support', 'judicial_remedy'],
      })
    }
    for (const report of openReports) {
      await createNotification(report.reporterUserId, 'seller_reply_report_resolved', {
        ...content,
        outcome: restricting ? 'upheld' : 'dismissed',
        reason: report.reason,
        details: report.details,
        redress: ['contact_support', 'judicial_remedy'],
      })
    }
  } catch (err) {
    logger.error('Failed to send seller reply moderation notifications', err, { replyId, status })
  }
}
