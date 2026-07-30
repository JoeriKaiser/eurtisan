import { and, asc, count, eq, ne, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { product, review, shop, shopSocials } from '#/db/schema'
import { decryptJsonb } from '../infra/encryption.server'
import { shopProfileViewsTotal } from '../infra/metrics.server'
import { computeRatingAverage } from '../search/relevance'
import {
  isPublishableProductionType,
  parsePublicOrigin,
  parsePublicPolicies,
  parsePublicSocials,
  scoreShopProfileCompleteness,
  SHOP_RATING_MIN_REVIEWS,
  type ShopProfile,
  type ShopRatingSummary,
} from './public-profile'

/**
 * Columns read for the public profile.
 *
 * `isSuspended` and `status` are read for the visibility guard and are never
 * returned. Everything omitted here is omitted deliberately — notably
 * `businessAddress`, `vatId`, `taxId`, `dateOfBirth`,
 * `businessRegistrationNumber`, `legalEntityType`, every `mollie*` column, the
 * moderation trail, and `ownerId`, which is a `user.id`.
 *
 * Never replace this with `select()`.
 */
const publicShopColumns = {
  id: shop.id,
  name: shop.name,
  slug: shop.slug,
  tagline: shop.tagline,
  description: shop.description,
  category: shop.category,
  tags: shop.tags,
  image: shop.image,
  bannerImage: shop.bannerImage,
  announcement: shop.announcement,
  productionType: shop.productionType,
  hasProductionPartner: shop.hasProductionPartner,
  productionPartnerDetails: shop.productionPartnerDetails,
  languages: shop.languages,
  isVatRegistered: shop.isVatRegistered,
  createdAt: shop.createdAt,
  shippingOrigin: shop.shippingOrigin,
  policies: shop.policies,
  isSuspended: shop.isSuspended,
  status: shop.status,
}

async function getProductCount(shopId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(product)
    .where(
      and(eq(product.shopId, shopId), eq(product.status, 'published'), eq(product.isActive, true)),
    )

  return row?.total ?? 0
}

/**
 * Aggregate rating across every product in the shop.
 *
 * Counts everything not `hidden`, matching the display convention in
 * `getProductReviewsQuery` (`src/lib/reviews/operations.server.ts`). Note that
 * search's `popularityScore` (`src/lib/products/meilisearch.server.ts`) counts
 * approved reviews only — the two conventions already differ, and this
 * deliberately does not introduce a third.
 */
async function getRatingSummary(shopId: string): Promise<ShopRatingSummary | null> {
  const [row] = await db
    .select({
      reviewCount: count(review.id),
      ratingSum: sql<string>`coalesce(sum(${review.rating}), 0)`,
    })
    .from(review)
    .innerJoin(product, eq(review.productId, product.id))
    .where(and(eq(product.shopId, shopId), ne(review.moderationStatus, 'hidden')))

  const reviewCount = row?.reviewCount ?? 0
  if (reviewCount < SHOP_RATING_MIN_REVIEWS) return null

  return {
    reviewCount,
    ratingAverage: computeRatingAverage({
      reviewCount,
      ratingSum: Number(row?.ratingSum ?? 0),
    }),
  }
}

async function getSocials(shopId: string) {
  const rows = await db
    .select({ platform: shopSocials.platform, url: shopSocials.url })
    .from(shopSocials)
    .where(eq(shopSocials.shopId, shopId))
    .orderBy(asc(shopSocials.platform))

  return parsePublicSocials(rows)
}

/**
 * Public storefront projection for a shop, or null when the shop does not exist
 * or is not publicly visible.
 *
 * A missing shop and a suspended shop are deliberately indistinguishable, so
 * suspension is not observable from outside — matching `getShopBySlugQuery`,
 * `getShopProductsQuery`, and the search index.
 */
export async function getShopProfileQuery(slug: string): Promise<ShopProfile | null> {
  const [row] = await db.select(publicShopColumns).from(shop).where(eq(shop.slug, slug)).limit(1)

  if (!row || row.isSuspended || row.status !== 'active') return null

  // Counted here rather than in the route loader: this is the one place a
  // storefront is actually served, and it is server-only, so a client-side
  // navigation cannot inflate it. Misses and suspended shops are not views.
  shopProfileViewsTotal.inc()

  const [productCount, rating, socials] = await Promise.all([
    getProductCount(row.id),
    getRatingSummary(row.id),
    getSocials(row.id),
  ])

  // `shippingOrigin` is written through `encryptJsonb`, so it must be decrypted
  // before anything can be read off it, and the narrowing to country /
  // processing time / international happens here rather than in the component
  // so the PII never crosses the boundary at all.
  const origin = parsePublicOrigin(decryptJsonb<unknown>(row.shippingOrigin))

  // The result is constructed field by field rather than spread, so a column
  // added to `publicShopColumns` cannot reach the response by accident.
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline,
    description: row.description,
    category: row.category,
    tags: row.tags ?? [],
    image: row.image,
    bannerImage: row.bannerImage,
    announcement: row.announcement,
    productionType: isPublishableProductionType(row.productionType) ? row.productionType : null,
    hasProductionPartner: row.hasProductionPartner ?? false,
    productionPartnerDetails: row.productionPartnerDetails,
    languages: row.languages ?? [],
    isVatRegistered: row.isVatRegistered,
    createdAt: row.createdAt,
    policies: parsePublicPolicies(row.policies),
    origin,
    socials,
    rating,
    productCount,
  }
}

/**
 * Completeness of every active shop's public profile, for
 * `eurtisan_shop_profile_completeness`.
 *
 * Two queries rather than one profile assembly per shop: this runs across the
 * whole marketplace on a schedule, and `getShopProfileQuery` would issue four
 * round trips each. Presence is all that is scored, so `shippingOrigin` is
 * tested for null without decrypting it — the ciphertext is as present as the
 * plaintext would be.
 */
export async function getShopProfileCompletenessSamples(): Promise<number[]> {
  const rows = await db
    .select({
      id: shop.id,
      tagline: shop.tagline,
      description: shop.description,
      category: shop.category,
      tags: shop.tags,
      image: shop.image,
      bannerImage: shop.bannerImage,
      announcement: shop.announcement,
      productionType: shop.productionType,
      languages: shop.languages,
      policies: shop.policies,
      shippingOrigin: shop.shippingOrigin,
    })
    .from(shop)
    .where(and(eq(shop.status, 'active'), eq(shop.isSuspended, false)))

  if (rows.length === 0) return []

  const socialCounts = await db
    .select({ shopId: shopSocials.shopId, total: count() })
    .from(shopSocials)
    .groupBy(shopSocials.shopId)
  const socialsByShopId = new Map(socialCounts.map((row) => [row.shopId, Number(row.total)]))

  const hasText = (value: string | null) => value !== null && value.trim().length > 0

  return rows.map((row) =>
    scoreShopProfileCompleteness({
      tagline: hasText(row.tagline),
      description: hasText(row.description),
      category: hasText(row.category),
      tags: (row.tags ?? []).length > 0,
      image: hasText(row.image),
      bannerImage: hasText(row.bannerImage),
      announcement: hasText(row.announcement),
      productionType: isPublishableProductionType(row.productionType),
      languages: (row.languages ?? []).length > 0,
      policies: row.policies !== null,
      origin: row.shippingOrigin !== null,
      socials: (socialsByShopId.get(row.id) ?? 0) > 0,
    }),
  )
}
