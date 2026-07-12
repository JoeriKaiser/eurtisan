import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import { db } from '#/db/index'
import { categories, product, productImage, shop } from '#/db/schema'
import { getDescendantCategoryIds } from '../categories.server'
import { logger } from '../logger.server'
import { searchQueriesTotal } from '../metrics.server'
import { sanitizeRichText, validatePlainText } from '../xss'
import { withServerCache } from '../server-cache.server'
import type {
  FeaturedShop,
  ListProductsFilters,
  PaginatedProducts,
  Pagination,
  ProductDetail,
  PublicProduct,
  RecentProduct,
  SearchFilters,
  SearchSortOption,
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

  if (filters.minPriceCents !== undefined) {
    conditions.push(gte(product.priceCents, filters.minPriceCents))
  }

  if (filters.maxPriceCents !== undefined) {
    conditions.push(lte(product.priceCents, filters.maxPriceCents))
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

  return {
    ...(result as unknown as PublicProduct),
    imageUrl: primaryImage?.url ?? null,
    images,
    shopDescription: result.shopDescription,
    categoryId: result.categoryId,
    shopIsVatRegistered: result.shopIsVatRegistered,
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

export async function getShopProductsQuery(
  shopSlug: string,
  search?: string,
  pagination: Pagination = { page: 1, pageSize: 20 },
): Promise<PaginatedProducts> {
  const [shopRow] = await db.select().from(shop).where(eq(shop.slug, shopSlug)).limit(1)

  if (!shopRow || shopRow.isSuspended || shopRow.status !== 'active') {
    throw new Response(
      JSON.stringify({ error: 'Not Found', message: 'Shop not found or suspended' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const page = Math.max(1, pagination.page)
  const pageSize = Math.min(100, Math.max(1, pagination.pageSize))
  const offset = (page - 1) * pageSize

  const conditions = [
    eq(shop.isSuspended, false),
    eq(product.status, 'published'),
    eq(product.isActive, true),
    eq(shop.slug, shopSlug),
  ]

  if (search !== undefined && search.trim().length > 0) {
    conditions.push(ilike(product.name, `%${search.trim()}%`))
  }

  const where = and(...conditions)

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
    .orderBy(desc(product.createdAt))
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

export async function listProductsByCategorySlugQuery(
  slug: string,
  pagination: Pagination = { page: 1, pageSize: 20 },
): Promise<PaginatedProducts> {
  const category = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1)

  if (category.length === 0) {
    return { products: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }
  }

  const page = Math.max(1, pagination.page)
  const pageSize = Math.min(100, Math.max(1, pagination.pageSize))
  const offset = (page - 1) * pageSize

  const descendantIds = await getDescendantCategoryIds(category[0].id)

  const where = and(
    inArray(product.categoryId, descendantIds),
    eq(shop.status, 'active'),
    eq(shop.isSuspended, false),
    eq(product.status, 'published'),
    eq(product.isActive, true),
  )

  const [totalResult] = await db
    .select({ total: count() })
    .from(product)
    .innerJoin(categories, eq(product.categoryId, categories.id))
    .innerJoin(shop, eq(product.shopId, shop.id))
    .where(where)

  const total = totalResult?.total ?? 0

  const products = await db
    .select(publicProductColumns)
    .from(product)
    .innerJoin(categories, eq(product.categoryId, categories.id))
    .innerJoin(shop, eq(product.shopId, shop.id))
    .where(where)
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
    const [[shopResult], [productResult], [countryResult]] = await Promise.all([
      db
        .select({ count: count() })
        .from(shop)
        .where(and(eq(shop.status, 'active'), eq(shop.isSuspended, false))),
      db
        .select({ count: count() })
        .from(product)
        .where(and(eq(product.status, 'published'), eq(product.isActive, true))),
      db
        .select({
          count: countDistinct(sql`lower(${shop.shippingOrigin}->>'country')`),
        })
        .from(shop)
        .where(
          and(
            eq(shop.status, 'active'),
            eq(shop.isSuspended, false),
            sql`${shop.shippingOrigin}->>'country' is not null`,
          ),
        ),
    ])

    return {
      sellerCount: Number(shopResult?.count ?? 0),
      productCount: Number(productResult?.count ?? 0),
      countryCount: Number(countryResult?.count ?? 0),
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
      searchQueriesTotal.inc({ has_results: meiliResult.products.length > 0 ? 'true' : 'false' })
      logger.info('[search] query executed', {
        query: trimmedQuery,
        results: meiliResult.products.length,
        total: meiliResult.total,
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

  const useFts = trimmedQuery.length > 0 && (await isTsvectorAvailable())

  let searchVector: ReturnType<typeof sql> | undefined
  let plainQuery: ReturnType<typeof sql> | undefined

  if (trimmedQuery.length > 0) {
    if (useFts) {
      searchVector = sql`to_tsvector('english', ${product.name} || ' ' || coalesce(${product.description}, ''))`
      plainQuery = sql`plainto_tsquery('english', ${trimmedQuery})`
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
    searchQueriesTotal.inc({ has_results: products.length > 0 ? 'true' : 'false' })
    logger.info('[search] query executed', {
      query: trimmedQuery,
      results: products.length,
      total: total,
    })
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