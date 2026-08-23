import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '#/db/index'
import {
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
import { formatReviewerName } from './display-name'
import { getDaysRemaining, isEligibleForReview } from './lifecycle'
import { PUBLIC_REVIEW_FILTER } from './visibility.server'
import type {
  AdminSellerRepliesResult,
  AdminReviewsResult,
  ProductReviewsResult,
  ReviewableItem,
  ReviewDistribution,
  ReviewEligibilityResult,
  ReviewSort,
} from './types'

const sellerReplyAuthor = alias(user, 'seller_reply_author')
const sellerReplyReviewBuyer = alias(user, 'seller_reply_review_buyer')

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
