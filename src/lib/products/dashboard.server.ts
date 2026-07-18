import { and, count, desc, eq, gte, inArray, lt, not, sum } from 'drizzle-orm'
import { db } from '#/db/index'
import { platformOrder, product, review, shop, shopOrder, shopSocials, user } from '#/db/schema'
import { decryptJsonb } from '#/lib/encryption.server'
import { PLATFORM_FEE_PERCENT } from '#/lib/platform-constants'
import type { Policies, SocialRow } from '#/lib/sell-onboarding'

export interface CreatorShop {
  id: string
  name: string
  slug: string
  status?: string
  image?: string | null
  bannerImage?: string | null
  announcement?: string | null
  socialCount?: number
  paymentConnected?: boolean
  mollieAccountId?: string | null
}

export interface ShippingOrigin {
  street: string
  city: string
  postalCode: string
  country: string
}

export interface CreatorShopDetail {
  id: string
  name: string
  slug: string
  description: string | null
  image: string | null
  bannerImage: string | null
  announcement: string | null
  status: string
  scheduledDeleteAt: Date | null
  ownerId: string
  shippingOrigin: ShippingOrigin | null
  businessAddress: ShippingOrigin | null
  isVatRegistered: boolean
  vatId: string | null
  legalEntityType: 'individual' | 'business' | null
  dateOfBirth: string | null
  taxId: string | null
  businessRegistrationNumber: string | null
  policies: Policies | null
  socials: SocialRow[]
  createdAt: Date
  updatedAt: Date
}

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export interface CreatorDashboardStats {
  revenueThisMonthCents: number
  pendingOrdersCount: number
  lowStockProductCount: number
  totalShopCount: number
}

export interface ShopDashboardStats {
  pendingOrdersCount: number
  lowStockProductCount: number
  revenueThisMonthCents: number
  netRevenueThisMonthCents: number
  totalActiveProducts: number
}

export interface OrderActivity {
  kind: 'order'
  id: string
  createdAt: Date
  orderId: string
  shopId: string
  shopName: string
  buyerName: string
  totalCents: number
  status: string
}

export interface ReviewActivity {
  kind: 'review'
  id: string
  createdAt: Date
  reviewId: string
  productId: string
  productName: string
  shopId: string
  shopName: string
  buyerName: string
  rating: number
  comment: string | null
}

export type CreatorActivity = OrderActivity | ReviewActivity

/* -------------------------------------------------------------------------- */
/*                                   Constants                                */
/* -------------------------------------------------------------------------- */

const PENDING_STATUSES = ['pending_payment', 'paid', 'processing'] as const
const REVENUE_STATUSES = [
  'paid',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'disputed',
] as const

/* -------------------------------------------------------------------------- */
/*                            Dashboard Stats Query                           */
/* -------------------------------------------------------------------------- */

export async function getCreatorDashboardStatsQuery(
  userId: string,
): Promise<CreatorDashboardStats> {
  const shops = await db
    .select({ id: shop.id })
    .from(shop)
    .where(and(eq(shop.ownerId, userId), not(eq(shop.status, 'archived'))))

  const shopIds = shops.map((s) => s.id)
  const totalShopCount = shopIds.length

  if (totalShopCount === 0) {
    return {
      revenueThisMonthCents: 0,
      pendingOrdersCount: 0,
      lowStockProductCount: 0,
      totalShopCount: 0,
    }
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [[lowStockResult], [pendingResult], [revenueResult]] = await Promise.all([
    db
      .select({ count: count() })
      .from(product)
      .where(and(inArray(product.shopId, shopIds), lt(product.stockCount, 5))),
    db
      .select({ count: count() })
      .from(shopOrder)
      .where(and(inArray(shopOrder.shopId, shopIds), inArray(shopOrder.status, PENDING_STATUSES))),
    db
      .select({ total: sum(shopOrder.subtotalCents) })
      .from(shopOrder)
      .where(
        and(
          inArray(shopOrder.shopId, shopIds),
          inArray(shopOrder.status, REVENUE_STATUSES),
          gte(shopOrder.createdAt, startOfMonth),
        ),
      ),
  ])

  return {
    revenueThisMonthCents: Number(revenueResult?.total ?? 0),
    pendingOrdersCount: Number(pendingResult?.count ?? 0),
    lowStockProductCount: Number(lowStockResult?.count ?? 0),
    totalShopCount,
  }
}

/* -------------------------------------------------------------------------- */
/*                             Per-Shop Dashboard Stats                       */
/* -------------------------------------------------------------------------- */

export async function getShopDashboardStatsQuery(shopId: string): Promise<ShopDashboardStats> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    [lowStockResult],
    [pendingResult],
    [revenueResult],
    [refundResult],
    [activeProductsResult],
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(product)
      .where(and(eq(product.shopId, shopId), lt(product.stockCount, 5))),
    db
      .select({ count: count() })
      .from(shopOrder)
      .where(and(eq(shopOrder.shopId, shopId), inArray(shopOrder.status, PENDING_STATUSES))),
    db
      .select({ total: sum(shopOrder.subtotalCents) })
      .from(shopOrder)
      .where(
        and(
          eq(shopOrder.shopId, shopId),
          inArray(shopOrder.status, REVENUE_STATUSES),
          gte(shopOrder.createdAt, startOfMonth),
        ),
      ),
    db
      .select({ total: sum(shopOrder.subtotalCents) })
      .from(shopOrder)
      .where(
        and(
          eq(shopOrder.shopId, shopId),
          eq(shopOrder.status, 'refunded'),
          gte(shopOrder.createdAt, startOfMonth),
        ),
      ),
    db
      .select({ count: count() })
      .from(product)
      .where(
        and(
          eq(product.shopId, shopId),
          eq(product.status, 'published'),
          eq(product.isActive, true),
        ),
      ),
  ])

  const grossCents = Number(revenueResult?.total ?? 0)
  const refundCents = Number(refundResult?.total ?? 0)
  const netCents = Math.round((grossCents - refundCents) * (1 - PLATFORM_FEE_PERCENT / 100))

  return {
    pendingOrdersCount: Number(pendingResult?.count ?? 0),
    lowStockProductCount: Number(lowStockResult?.count ?? 0),
    revenueThisMonthCents: grossCents,
    netRevenueThisMonthCents: netCents,
    totalActiveProducts: Number(activeProductsResult?.count ?? 0),
  }
}

/* -------------------------------------------------------------------------- */
/*                             Creator Shops Query                            */
/* -------------------------------------------------------------------------- */

export async function getCreatorShopsQuery(userId: string): Promise<CreatorShop[]> {
  return db
    .select({
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      status: shop.status,
      image: shop.image,
      bannerImage: shop.bannerImage,
      announcement: shop.announcement,
      socialCount: count(shopSocials.id),
      paymentConnected: shop.paymentConnected,
      mollieAccountId: shop.mollieAccountId,
    })
    .from(shop)
    .leftJoin(shopSocials, eq(shopSocials.shopId, shop.id))
    .where(and(eq(shop.ownerId, userId), not(eq(shop.status, 'archived'))))
    .groupBy(shop.id)
    .orderBy(shop.name)
}

/**
 * Returns the full shop record for a specific shop owned by the user.
 * Returns null if the shop does not exist or is not owned by the user.
 */
export async function getCreatorShopQuery(
  userId: string,
  shopId: string,
): Promise<CreatorShopDetail | null> {
  const [record, socials] = await Promise.all([
    db
      .select()
      .from(shop)
      .where(and(eq(shop.id, shopId), eq(shop.ownerId, userId)))
      .limit(1)
      .then((rows) => rows[0]),
    db.select().from(shopSocials).where(eq(shopSocials.shopId, shopId)),
  ])

  if (!record) return null

  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    description: record.description,
    image: record.image,
    bannerImage: record.bannerImage,
    announcement: record.announcement,
    status: record.status,
    scheduledDeleteAt: record.scheduledDeleteAt,
    ownerId: record.ownerId,
    shippingOrigin: decryptJsonb<ShippingOrigin | null>(record.shippingOrigin) ?? null,
    businessAddress: decryptJsonb<ShippingOrigin | null>(record.businessAddress) ?? null,
    isVatRegistered: record.isVatRegistered,
    vatId: record.vatId,
    legalEntityType: record.legalEntityType as 'individual' | 'business' | null,
    dateOfBirth: record.dateOfBirth,
    taxId: record.taxId,
    businessRegistrationNumber: record.businessRegistrationNumber,
    policies: (record.policies as Policies | null) ?? null,
    socials: socials.map((s) => ({
      platform: s.platform as SocialRow['platform'],
      url: s.url,
    })),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

/* -------------------------------------------------------------------------- */
/*                           Recent Activity Query                            */
/* -------------------------------------------------------------------------- */

export async function getCreatorRecentActivityQuery(
  userId: string,
  limit: number,
): Promise<CreatorActivity[]> {
  const shops = await db
    .select({ id: shop.id })
    .from(shop)
    .where(and(eq(shop.ownerId, userId), not(eq(shop.status, 'archived'))))

  const shopIds = shops.map((s) => s.id)

  if (shopIds.length === 0) {
    return []
  }

  const validatedLimit = Math.min(100, Math.max(1, limit))

  const [ordersResult, reviewsResult] = await Promise.all([
    db
      .select({
        id: shopOrder.id,
        shopId: shopOrder.shopId,
        shopName: shop.name,
        status: shopOrder.status,
        subtotalCents: shopOrder.subtotalCents,
        shippingCostCents: shopOrder.shippingCostCents,
        createdAt: shopOrder.createdAt,
        buyerName: user.name,
      })
      .from(shopOrder)
      .innerJoin(shop, eq(shopOrder.shopId, shop.id))
      .innerJoin(platformOrder, eq(shopOrder.platformOrderId, platformOrder.id))
      .innerJoin(user, eq(platformOrder.userId, user.id))
      .where(inArray(shopOrder.shopId, shopIds))
      .orderBy(desc(shopOrder.createdAt))
      .limit(validatedLimit),
    db
      .select({
        id: review.id,
        productId: review.productId,
        productName: product.name,
        shopId: shop.id,
        shopName: shop.name,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        buyerName: user.name,
      })
      .from(review)
      .innerJoin(product, eq(review.productId, product.id))
      .innerJoin(shop, eq(product.shopId, shop.id))
      .innerJoin(user, eq(review.buyerUserId, user.id))
      .where(inArray(shop.id, shopIds))
      .orderBy(desc(review.createdAt))
      .limit(validatedLimit),
  ])

  const activities: CreatorActivity[] = [
    ...ordersResult.map(
      (o): OrderActivity => ({
        kind: 'order',
        id: `order-${o.id}`,
        createdAt: o.createdAt,
        orderId: o.id,
        shopId: o.shopId,
        shopName: o.shopName,
        buyerName: o.buyerName,
        totalCents: o.subtotalCents + o.shippingCostCents,
        status: o.status,
      }),
    ),
    ...reviewsResult.map(
      (r): ReviewActivity => ({
        kind: 'review',
        id: `review-${r.id}`,
        createdAt: r.createdAt,
        reviewId: r.id,
        productId: r.productId,
        productName: r.productName,
        shopId: r.shopId,
        shopName: r.shopName,
        buyerName: r.buyerName,
        rating: r.rating,
        comment: r.comment,
      }),
    ),
  ]

  activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return activities.slice(0, validatedLimit)
}
