import { and, asc, count, desc, eq, gt, gte, ilike, inArray, lte, ne, or, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { categories, product, productImage, review, shop } from '#/db/schema'
import { getDescendantCategoryIds } from '../categories.server'
import { decryptJsonb } from '../encryption.server'
import { PUBLIC_REVIEW_FILTER } from '../reviews/visibility.server'
import { computeRatingAverage } from '../search/relevance'
import { logger } from '../logger.server'
import { searchQueriesTotal } from '../metrics.server'
import { recordSearchEvent } from '../search/analytics.server'
import { sanitizeRichText, validatePlainText } from '../xss'
import { withServerCache } from '../server-cache.server'
import type {
  CategoryProductsOptions,
  FeaturedShop,
  ListProductsFilters,
  PaginatedProducts,
  Pagination,
  ProductDetail,
  PublicProduct,
  RecentProduct,
  SearchFilters,
  SearchSortOption,
  ShopProductCategory,
  ShopProductsOptions,
  ShopSummary,
  SortOption,
} from './types'

function parsePriceToCents(price: string): number {
  const parsed = parseFloat(price.trim())
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error('Invalid price value')
  }
  return Math.round(parsed * 100)
}

const publicProductColumns = {
  id: product.id,
  name: product.name,
  description: product.description,
  slug: product.slug,
  priceCents: product.priceCents,
  stockCount: product.stockCount,
  isActive: product.isActive,
  status: product.status,
  publishedAt: product.publishedAt,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
  categoryName: categories.name,
  categorySlug: categories.slug,
  shopName: shop.name,
  shopSlug: shop.slug,
  shopIsVatRegistered: shop.isVatRegistered,
}

export async function fetchFirstImageUrls(productIds: string[]): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map()

  const images = await db
    .select({
      productId: productImage.productId,
      url: productImage.url,
    })
    .from(productImage)
    .where(and(inArray(productImage.productId, productIds), eq(productImage.sortOrder, 0)))

  return new Map(images.map((img) => [img.productId, img.url]))
}

function buildProductWhere(filters: ListProductsFilters) {
  const conditions = [
    eq(shop.status, 'active'),
    eq(shop.isSuspended, false),
    eq(product.status, 'published'),
    eq(product.isActive, true),
  ]

  if (filters.shopSlug) {
    conditions.push(eq(shop.slug, filters.shopSlug))
  }

  if (filters.categorySlug) {
    conditions.push(eq(categories.slug, filters.categorySlug))
  }

  // Deliberately separate from `categorySlug` rather than folded into it: the
  // two have different semantics (exact vs. descendant-aware), and silently
  // making the slug filter recursive would change what the shop storefront
  // shows. See the field docs on `ListProductsFilters`.
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    conditions.push(inArray(product.categoryId, filters.categoryIds))
  }

  if (filters.excludeProductId) {
    conditions.push(ne(product.id, filters.excludeProductId))
  }

  if (filters.minPriceCents !== undefined) {
    conditions.push(gte(product.priceCents, filters.minPriceCents))
  }

  if (filters.maxPriceCents !== undefined) {
    conditions.push(lte(product.priceCents, filters.maxPriceCents))
  }

  if (filters.search !== undefined && filters.search.trim().length > 0) {
    conditions.push(ilike(product.name, `%${filters.search.trim()}%`))
  }

  if (filters.inStockOnly) {
    // Deliberately identical to search's definition (`searchProductsQuery`
    // below, and `meilisearch.server.ts`): stock on the product row only.
    // `productVariant.stockCount` is an independent column that nothing
    // aggregates back into `product.stockCount`, so a variant product with
    // stock on every variant and zero on its parent row counts as out of stock
    // here — exactly as it already does in search. Fixing that belongs to the
    // catalog domain; two disagreeing definitions of "in stock" would be worse
    // than one consistent limitation.
    conditions.push(gt(product.stockCount, 0))
  }

  return and(...conditions)
}

function buildOrderBy(sort: SortOption) {
  switch (sort) {
    case 'price_asc':
      return asc(product.priceCents)
    case 'price_desc':
      return desc(product.priceCents)
    default:
      return desc(product.createdAt)
  }
}

export async function listProductsQuery(
  filters: ListProductsFilters = {},
  pagination: Pagination = { page: 1, pageSize: 20 },
  sort: SortOption = 'newest',
): Promise<PaginatedProducts> {
  const page = Math.max(1, pagination.page)
  const pageSize = Math.min(100, Math.max(1, pagination.pageSize))
  const offset = (page - 1) * pageSize

  const where = buildProductWhere(filters)

  const [totalResult] = await db
    .select({ total: count() })
    .from(product)
    .innerJoin(shop, eq(product.shopId, shop.id))
    .leftJoin(categories, eq(product.categoryId, categories.id))
    .where(where)

  const total = totalResult?.total ?? 0

  const products = await db
    .select(publicProductColumns)
    .from(product)
    .innerJoin(shop, eq(product.shopId, shop.id))
    .leftJoin(categories, eq(product.categoryId, categories.id))
    .where(where)
    .orderBy(buildOrderBy(sort))
    .limit(pageSize)
    .offset(offset)

  const imageUrls = await fetchFirstImageUrls(products.map((p) => p.id))

  return {
    products: products.map((p) => ({
      ...p,
      imageUrl: imageUrls.get(p.id) ?? null,
    })) as PublicProduct[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function getProductBySlugQuery(
  shopSlug: string,
  productSlug: string,
): Promise<ProductDetail | null> {
  const [result] = await db
    .select({
      ...publicProductColumns,
      shopDescription: shop.description,
      categoryId: product.categoryId,
      shopIsVatRegistered: shop.isVatRegistered,
      lowStockThreshold: product.lowStockThreshold,
      // Encrypted at rest, so it is decrypted below rather than read in SQL.
      shippingOrigin: shop.shippingOrigin,
    })
    .from(product)
    .innerJoin(shop, eq(product.shopId, shop.id))
    .leftJoin(categories, eq(product.categoryId, categories.id))
    .where(
      and(
        eq(shop.slug, shopSlug),
        eq(product.slug, productSlug),
        eq(shop.status, 'active'),
        eq(shop.isSuspended, false),
        eq(product.status, 'published'),
        eq(product.isActive, true),
      ),
    )
    .limit(1)

  if (!result) return null

  const images = await db
    .select({
      id: productImage.id,
      url: productImage.url,
      altText: productImage.altText,
      sortOrder: productImage.sortOrder,
    })
    .from(productImage)
    .where(eq(productImage.productId, result.id))
    .orderBy(asc(productImage.sortOrder))

  const primaryImage = images.find((img) => img.sortOrder === 0) ?? images[0] ?? null

  // Same filter as the review list and the search index, so the compact rating
  // by the price cannot disagree with the full summary further down the page.
  const [ratingRow] = await db
    .select({
      reviewCount: count(review.id),
      ratingSum: sql<string>`coalesce(sum(${review.rating}), 0)`,
    })
    .from(review)
    .where(and(eq(review.productId, result.id), PUBLIC_REVIEW_FILTER))

  const reviewCount = ratingRow?.reviewCount ?? 0
  const rating =
    reviewCount > 0
      ? {
          reviewCount,
          average: computeRatingAverage({
            reviewCount,
            ratingSum: Number(ratingRow?.ratingSum ?? 0),
          }),
        }
      : null

  // Only the dispatch window is taken off the origin. The rest of that object
  // is the shop's dispatch address, which must not reach a public page.
  const origin = decryptJsonb<{ processingTimeDays?: { min?: number; max?: number } } | null>(
    result.shippingOrigin,
  )
  const processing = origin?.processingTimeDays
  const dispatchDays =
    typeof processing?.min === 'number' && typeof processing?.max === 'number'
      ? { min: processing.min, max: processing.max }
      : null

  return {
    ...(result as unknown as PublicProduct),
    imageUrl: primaryImage?.url ?? null,
    images,
    shopDescription: result.shopDescription,
    categoryId: result.categoryId,
    shopIsVatRegistered: result.shopIsVatRegistered,
    lowStockThreshold: result.lowStockThreshold,
    dispatchDays,
    rating,
  }
}

export async function getProductsByShopSlugQuery(
  shopSlug: string,
  pagination: Pagination = { page: 1, pageSize: 20 },
): Promise<PaginatedProducts> {
  const [shopRow] = await db.select().from(shop).where(eq(shop.slug, shopSlug)).limit(1)

  if (!shopRow || shopRow.isSuspended || shopRow.status !== 'active') {
    throw new Response(
      JSON.stringify({ error: 'Not Found', message: 'Shop not found or suspended' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return listProductsQuery({ shopSlug }, pagination, 'newest')
}

/**
 * Other products from the same shop, for the product page's rail.
 *
 * Routed through `listProductsQuery` rather than hand-rolled, so it inherits
 * every visibility filter and a deterministic `ORDER BY` — the two things the
 * category page turned out to be missing when it hand-rolled its own.
 *
 * Deliberately not "related products". There is no recommender in this codebase,
 * and inventing one from category adjacency produces a rail of things that
 * merely share a label.
 */
export async function getMoreFromShopQuery(
  shopSlug: string,
  excludeProductId: string,
  limit = 4,
): Promise<PublicProduct[]> {
  const result = await listProductsQuery(
    { shopSlug, excludeProductId },
    { page: 1, pageSize: limit },
    'newest',
  )
  return result.products
}

export async function getShopBySlugQuery(slug: string): Promise<ShopSummary | null> {
  const [shopRow] = await db
    .select({
      id: shop.id,
      name: shop.name,
      description: shop.description,
      slug: shop.slug,
      image: shop.image,
      isSuspended: shop.isSuspended,
      status: shop.status,
    })
    .from(shop)
    .where(eq(shop.slug, slug))
    .limit(1)

  if (!shopRow || shopRow.isSuspended || shopRow.status !== 'active') {
    return null
  }

  const { isSuspended: _, status: __, ...summary } = shopRow
  return summary
}

/**
 * Throws a 404 unless the shop exists and is publicly visible.
 *
 * A missing shop and a suspended shop are deliberately indistinguishable to the
 * caller, matching `getShopBySlugQuery` and the search index, so suspension is
 * not observable from outside.
 */
async function assertShopIsPubliclyVisible(shopSlug: string): Promise<void> {
  const [shopRow] = await db
    .select({ isSuspended: shop.isSuspended, status: shop.status })
    .from(shop)
    .where(eq(shop.slug, shopSlug))
    .limit(1)

  if (!shopRow || shopRow.isSuspended || shopRow.status !== 'active') {
    throw new Response(
      JSON.stringify({ error: 'Not Found', message: 'Shop not found or suspended' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

export async function getShopProductsQuery(
  shopSlug: string,
  options: ShopProductsOptions = {},
): Promise<PaginatedProducts> {
  // An unknown shop must 404 rather than render as an empty storefront, so the
  // existence check stays separate from the listing, which returns no rows.
  await assertShopIsPubliclyVisible(shopSlug)

  return listProductsQuery(
    {
      shopSlug,
      search: options.search,
      categorySlug: options.categorySlug,
      inStockOnly: options.inStockOnly,
    },
    options.pagination ?? { page: 1, pageSize: 20 },
    options.sort ?? 'newest',
  )
}

/**
 * Categories that actually occur in this shop's publicly visible products.
 *
 * Offering the full marketplace taxonomy on a storefront would be mostly dead
 * options, so the filter is built from the shop's own catalogue — the same
 * principle as search's facet counts, cheap here because the set is one shop.
 *
 * Deliberately independent of the current search and filter state: a category
 * list that shrank to the selected value would strand the buyer with no way
 * back. Suspended and inactive shops return nothing rather than 404 — callers
 * reach this only after `getShopProfile` has already gated on visibility.
 */
export async function getShopProductCategoriesQuery(
  shopSlug: string,
): Promise<ShopProductCategory[]> {
  return db
    .selectDistinct({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
    })
    .from(product)
    .innerJoin(shop, eq(product.shopId, shop.id))
    .innerJoin(categories, eq(product.categoryId, categories.id))
    .where(
      and(
        eq(shop.slug, shopSlug),
        eq(shop.status, 'active'),
        eq(shop.isSuspended, false),
        eq(product.status, 'published'),
        eq(product.isActive, true),
      ),
    )
    .orderBy(asc(categories.name))
}

export async function listProductsByShopQuery(shopId: string, limit = 20, offset = 0) {
  const boundedLimit = Math.min(100, Math.max(1, limit))
  const boundedOffset = Math.max(0, offset)
  return db
    .select()
    .from(product)
    .where(eq(product.shopId, shopId))
    .limit(boundedLimit)
    .offset(boundedOffset)
}

/**
 * Products in a category, including everything beneath it in the tree.
 *
 * Routed through `listProductsQuery` so visibility rules, price and stock
 * filters, and ordering come from one place. The category match is by id via
 * `getDescendantCategoryIds`, **not** by slug: `buildProductWhere`'s slug filter
 * is an exact match, and using it here would drop every subcategory product the
 * moment a buyer browsed a parent.
 *
 * The previous implementation also issued no `ORDER BY`, so PostgreSQL was free
 * to return rows in any order and a buyer paging through a category could see
 * the same product twice or miss one entirely.
 */
export async function listProductsByCategorySlugQuery(
  slug: string,
  pagination: Pagination = { page: 1, pageSize: 20 },
  options: CategoryProductsOptions = {},
): Promise<PaginatedProducts> {
  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1)

  if (!category) {
    return { products: [], total: 0, page: 1, pageSize: pagination.pageSize, totalPages: 0 }
  }

  const categoryIds = await getDescendantCategoryIds(category.id)

  return listProductsQuery(
    {
      categoryIds,
      minPriceCents: options.minPriceCents,
      maxPriceCents: options.maxPriceCents,
      inStockOnly: options.inStockOnly,
    },
    pagination,
    options.sort ?? 'newest',
  )
}

export async function listRecentProductsQuery(limit = 8): Promise<RecentProduct[]> {
  const productsResult = await listProductsQuery({}, { page: 1, pageSize: limit }, 'newest')
  const products = productsResult.products

  if (products.length === 0) return []

  const images = await db
    .select({
      productId: productImage.productId,
      id: productImage.id,
      url: productImage.url,
      altText: productImage.altText,
      sortOrder: productImage.sortOrder,
    })
    .from(productImage)
    .where(
      inArray(
        productImage.productId,
        products.map((p) => p.id),
      ),
    )
    .orderBy(asc(productImage.sortOrder))

  const firstImageByProduct = new Map<string, (typeof images)[number]>()
  for (const img of images) {
    if (!firstImageByProduct.has(img.productId)) {
      firstImageByProduct.set(img.productId, img)
    }
  }

  return products.map((p) => ({
    ...p,
    image: firstImageByProduct.get(p.id) ?? null,
  }))
}

export async function getFeaturedShopsQuery(limit: number): Promise<FeaturedShop[]> {
  const result = await db
    .select({
      id: shop.id,
      name: shop.name,
      description: shop.description,
      slug: shop.slug,
      productCount: count(
        sql`CASE WHEN ${product.status} = 'published' AND ${product.isActive} THEN 1 END`,
      ),
      tagline: shop.tagline,
      category: shop.category,
      image: shop.image,
    })
    .from(shop)
    .leftJoin(product, eq(product.shopId, shop.id))
    .where(and(eq(shop.status, 'active'), eq(shop.isSuspended, false)))
    .groupBy(shop.id)
    .orderBy(desc(shop.createdAt))
    .limit(limit)

  return result.map((r) => ({
    ...r,
    productCount: Number(r.productCount),
  }))
}

const MARKETPLACE_STATS_CACHE_KEY = 'cache:marketplace:stats'
const MARKETPLACE_STATS_TTL_MS = 60_000

export async function getMarketplaceStatsQuery(): Promise<{
  sellerCount: number
  productCount: number
  countryCount: number
}> {
  return withServerCache(MARKETPLACE_STATS_CACHE_KEY, MARKETPLACE_STATS_TTL_MS, async () => {
    const [[shopResult], [productResult], originRows] = await Promise.all([
      db
        .select({ count: count() })
        .from(shop)
        .where(and(eq(shop.status, 'active'), eq(shop.isSuspended, false))),
      db
        .select({ count: count() })
        .from(product)
        .where(and(eq(product.status, 'published'), eq(product.isActive, true))),
      // `shippingOrigin` is encrypted at rest, so it is a JSON *string* in the
      // column and `->>'country'` yields NULL for every row — this count was
      // silently 0 on the homepage. SQL cannot see inside the ciphertext, so
      // the distinct-count has to happen after decryption, in application code.
      // Bounded by the number of active shops and cached for
      // MARKETPLACE_STATS_TTL_MS.
      db
        .select({ shippingOrigin: shop.shippingOrigin })
        .from(shop)
        .where(and(eq(shop.status, 'active'), eq(shop.isSuspended, false))),
    ])

    const countries = new Set<string>()
    for (const row of originRows) {
      const country = decryptJsonb<{ country?: string } | null>(row.shippingOrigin)?.country
      if (country) countries.add(country.toLowerCase())
    }

    return {
      sellerCount: Number(shopResult?.count ?? 0),
      productCount: Number(productResult?.count ?? 0),
      countryCount: countries.size,
    }
  })
}

let tsvectorAvailable: boolean | null = null

async function isTsvectorAvailable(): Promise<boolean> {
  if (tsvectorAvailable !== null) return tsvectorAvailable
  try {
    await db.execute(sql`SELECT to_tsvector('english', 'test')`)
    tsvectorAvailable = true
    return true
  } catch {
    tsvectorAvailable = false
    return false
  }
}

function buildSearchOrderBy(sort: SearchSortOption, useFts: boolean) {
  switch (sort) {
    case 'relevance':
      if (useFts) {
        return undefined // rank is applied dynamically
      }
      return desc(product.createdAt)
    case 'price_asc':
      return asc(product.priceCents)
    case 'price_desc':
      return desc(product.priceCents)
    default:
      return desc(product.createdAt)
  }
}

export async function searchProductsQuery(
  query: string | undefined,
  filters: SearchFilters = {},
  sort: SearchSortOption = 'relevance',
  pagination: Pagination = { page: 1, pageSize: 24 },
): Promise<PaginatedProducts> {
  const trimmedQuery = (query ?? '').trim().slice(0, 100)
  const page = Math.max(1, pagination.page)
  const pageSize = Math.min(100, Math.max(1, pagination.pageSize))

  const { searchProductsMeilisearch } = await import('../meilisearch-products.server')
  const meiliResult = await searchProductsMeilisearch(trimmedQuery || undefined, filters, sort, {
    page,
    pageSize,
  })
  if (meiliResult) {
    if (trimmedQuery) {
      searchQueriesTotal.inc({ has_results: meiliResult.total > 0 ? 'true' : 'false' })
      await recordSearchEvent({
        query: trimmedQuery,
        resultCount: meiliResult.total,
        source: 'meilisearch',
      })
    }
    return meiliResult
  }

  const offset = (page - 1) * pageSize

  const conditions = [
    eq(shop.status, 'active'),
    eq(shop.isSuspended, false),
    eq(product.status, 'published'),
    eq(product.isActive, true),
  ]

  if (filters.shopSlug) {
    conditions.push(eq(shop.slug, filters.shopSlug))
  }

  if (filters.categorySlug) {
    conditions.push(eq(categories.slug, filters.categorySlug))
  }

  if (filters.minPriceCents !== undefined) {
    conditions.push(gte(product.priceCents, filters.minPriceCents))
  }

  if (filters.maxPriceCents !== undefined) {
    conditions.push(lte(product.priceCents, filters.maxPriceCents))
  }

  if (filters.inStockOnly) {
    conditions.push(gt(product.stockCount, 0))
  }

  const useFts = trimmedQuery.length > 0 && (await isTsvectorAvailable())

  let searchVector: ReturnType<typeof sql> | undefined
  let plainQuery: ReturnType<typeof sql> | undefined

  if (trimmedQuery.length > 0) {
    if (useFts) {
      // Listings are written in English or Dutch, so stem against both
      // dictionaries and OR the queries together. The English stemmer leaves
      // Dutch inflections intact, so "sokken" never matched a search for
      // "sok"; the Dutch stemmer reduces both to the same root.
      const searchText = sql`${product.name} || ' ' || coalesce(${product.description}, '')`
      searchVector = sql`(to_tsvector('english', ${searchText}) || to_tsvector('dutch', ${searchText}))`
      plainQuery = sql`(plainto_tsquery('english', ${trimmedQuery}) || plainto_tsquery('dutch', ${trimmedQuery}))`
      conditions.push(sql`${searchVector} @@ ${plainQuery}`)
    } else {
      const searchCondition = or(
        ilike(product.name, `%${trimmedQuery}%`),
        ilike(product.description, `%${trimmedQuery}%`),
      )
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }
  }

  const where = and(...conditions)

  const [totalResult] = await db
    .select({ total: count() })
    .from(product)
    .innerJoin(shop, eq(product.shopId, shop.id))
    .leftJoin(categories, eq(product.categoryId, categories.id))
    .where(where)

  const total = totalResult?.total ?? 0

  const orderBy = buildSearchOrderBy(sort, useFts)

  const products = await (() => {
    const base = db
      .select(publicProductColumns)
      .from(product)
      .innerJoin(shop, eq(product.shopId, shop.id))
      .leftJoin(categories, eq(product.categoryId, categories.id))
      .where(where)

    if (sort === 'relevance' && useFts && searchVector && plainQuery) {
      const rank = sql`ts_rank(${searchVector}, ${plainQuery})`
      return base.orderBy(desc(rank)).limit(pageSize).offset(offset)
    }

    if (orderBy) {
      return base.orderBy(orderBy).limit(pageSize).offset(offset)
    }

    return base.limit(pageSize).offset(offset)
  })()

  if (trimmedQuery) {
    searchQueriesTotal.inc({ has_results: total > 0 ? 'true' : 'false' })
    await recordSearchEvent({ query: trimmedQuery, resultCount: total, source: 'postgres' })
  }

  const imageUrls = await fetchFirstImageUrls(products.map((p) => p.id))

  return {
    products: products.map((p) => ({
      ...p,
      imageUrl: imageUrls.get(p.id) ?? null,
    })) as PublicProduct[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function searchSuggestionsFallbackQuery(query: string) {
  const trimmedQuery = query.trim().slice(0, 255)

  const results = await db
    .select({
      name: product.name,
      slug: product.slug,
      shopSlug: shop.slug,
      categorySlug: categories.slug,
    })
    .from(product)
    .innerJoin(shop, eq(product.shopId, shop.id))
    .leftJoin(categories, eq(product.categoryId, categories.id))
    .where(
      and(
        eq(shop.status, 'active'),
        eq(shop.isSuspended, false),
        eq(product.status, 'published'),
        eq(product.isActive, true),
        ilike(product.name, `%${trimmedQuery}%`),
      ),
    )
    .limit(6)

  return results
}

export async function listShopsQuery(
  limit = 20,
  offset = 0,
): Promise<{ id: string; name: string; slug: string }[]> {
  const boundedLimit = Math.min(100, Math.max(1, limit))
  const boundedOffset = Math.max(0, offset)
  return db
    .select({
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
    })
    .from(shop)
    .where(and(eq(shop.status, 'active'), eq(shop.isSuspended, false)))
    .orderBy(shop.name)
    .limit(boundedLimit)
    .offset(boundedOffset)
}

export async function createProductInternal(data: {
  name: string
  description?: string
  slug: string
  price: string
  shopId: string
  categoryId?: string
}) {
  const existing = await db
    .select()
    .from(product)
    .where(and(eq(product.slug, data.slug), eq(product.shopId, data.shopId)))
    .limit(1)

  if (existing.length > 0) {
    throw new Error(`A product with slug "${data.slug}" already exists in this shop`)
  }

  const [[newProduct], { syncProductToMeilisearch }] = await Promise.all([
    db
      .insert(product)
      .values({
        id: crypto.randomUUID(),
        name: validatePlainText(data.name, 'Product name'),
        description: sanitizeRichText(data.description),
        slug: data.slug.trim(),
        priceCents: parsePriceToCents(data.price),
        shopId: data.shopId,
        categoryId: data.categoryId ?? null,
        status: 'published',
        isActive: true,
        publishedAt: new Date(),
      })
      .returning(),
    import('../meilisearch-products.server'),
  ])
  try {
    await syncProductToMeilisearch(newProduct)
  } catch (err) {
    logger.warn('Failed to sync product to Meilisearch', { productId: newProduct.id, error: err })
  }

  return newProduct
}
