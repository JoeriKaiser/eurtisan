import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { orderItem, platformOrder, product, review, shop, shopOrder, user } from '#/db/schema'
import { sanitizeRichText } from './xss'

export interface ReviewableItem {
  shopOrderId: string
  productId: string
  productName: string
  deliveredAt: Date | null
  isEligible: boolean
  daysRemaining: number | null
  hasReview: boolean
}

export interface ReviewEligibilityResult {
  items: ReviewableItem[]
}

export interface CreatedReview {
  id: string
  shopOrderId: string
  productId: string
  rating: number
  comment: string | null
  createdAt: Date
}

export interface ProductReview {
  id: string
  buyerName: string
  rating: number
  comment: string | null
  createdAt: Date
}

export interface ReviewDistribution {
  rating: number
  count: number
}

export interface ProductReviewsResult {
  reviews: ProductReview[]
  total: number
  averageRating: number | null
  distribution: ReviewDistribution[]
  page: number
  pageSize: number
  totalPages: number
}

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
    // Unique constraint violation (23505) — duplicate review race condition
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      throw new Response(
        JSON.stringify({ error: 'Conflict', message: 'Review already exists for this order item' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }
    throw err
  }

  // Notify seller after the review creation so errors don't break the transaction
  try {
    const [{ createNotification }, [shopRecord], [productRecord]] = await Promise.all([
      import('./notifications.server'),
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
    .where(eq(review.productId, productId))

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
      })
      .from(review)
      .innerJoin(user, eq(review.buyerUserId, user.id))
      .where(eq(review.productId, productId))
      .orderBy(desc(review.createdAt))
      .limit(validatedPageSize)
      .offset(offset),
    db
      .select({ average: sql<number | null>`round(avg(${review.rating})::numeric, 1)` })
      .from(review)
      .where(eq(review.productId, productId)),
    db
      .select({
        rating: review.rating,
        count: count(),
      })
      .from(review)
      .where(eq(review.productId, productId))
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
      buyerName: r.buyerName,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
    })),
    total,
    averageRating: avgResult?.average != null ? Number(avgResult.average) : null,
    distribution,
    page: validatedPage,
    pageSize: validatedPageSize,
    totalPages: Math.ceil(total / validatedPageSize),
  }
}
