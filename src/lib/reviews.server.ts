import { and, eq, gte, inArray } from 'drizzle-orm'
import { db } from '#/db/index'
import { orderItem, platformOrder, product, review, shopOrder } from '#/db/schema'

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

  const itemsResult = await db
    .select()
    .from(orderItem)
    .where(inArray(orderItem.shopOrderId, shopOrderIds))

  const reviewsResult = await db
    .select()
    .from(review)
    .where(inArray(review.shopOrderId, shopOrderIds))

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

  const sanitizedComment = comment ? sanitizeComment(comment) : null

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

  return {
    id: created.id,
    shopOrderId: created.shopOrderId,
    productId: created.productId,
    rating: created.rating,
    comment: created.comment,
    createdAt: created.createdAt,
  }
}

function sanitizeComment(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim()
}
