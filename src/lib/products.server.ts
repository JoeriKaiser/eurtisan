import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { categories, product, productImage, shop } from '#/db/schema'

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
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
  categoryName: categories.name,
  categorySlug: categories.slug,
  shopName: shop.name,
  shopSlug: shop.slug,
}

export type PublicProduct = {
  id: string
  name: string
  description: string | null
  slug: string
  priceCents: number
  stockCount: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  categoryName: string | null
  categorySlug: string | null
  shopName: string | null
  shopSlug: string | null
}

export type RecentProduct = PublicProduct & {
  image: { id: string; url: string; altText: string | null; sortOrder: number } | null
}

export type FeaturedShop = {
  id: string
  name: string
  description: string | null
  slug: string
  productCount: number
}

export type ProductDetail = PublicProduct & {
  images: { id: string; url: string; altText: string | null; sortOrder: number }[]
  shopDescription: string | null
  categoryId: string | null
}

export type ListProductsFilters = {
  shopSlug?: string
  categorySlug?: string
  activeOnly?: boolean
  minPriceCents?: number
  maxPriceCents?: number
}

export type Pagination = {
  page: number
  pageSize: number
}

export type SortOption = 'newest' | 'price_asc' | 'price_desc'

export type SearchSortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest'

export type SearchFilters = {
  categorySlug?: string
  shopSlug?: string
  minPriceCents?: number
  maxPriceCents?: number
}

export type PaginatedProducts = {
  products: PublicProduct[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function buildProductWhere(filters: ListProductsFilters) {
  const conditions = [eq(shop.isSuspended, false), eq(product.isActive, true)]

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

  return {
    products: products as PublicProduct[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function getProductBySlugQuery(slug: string): Promise<ProductDetail | null> {
  const [result] = await db
    .select({
      ...publicProductColumns,
      shopDescription: shop.description,
      categoryId: product.categoryId,
    })
    .from(product)
    .innerJoin(shop, eq(product.shopId, shop.id))
    .leftJoin(categories, eq(product.categoryId, categories.id))
    .where(and(eq(product.slug, slug), eq(shop.isSuspended, false), eq(product.isActive, true)))
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

  return {
    ...(result as unknown as PublicProduct),
    images,
    shopDescription: result.shopDescription,
    categoryId: result.categoryId,
  }
}

export async function getProductsByShopSlugQuery(
  shopSlug: string,
  pagination: Pagination = { page: 1, pageSize: 20 },
): Promise<PaginatedProducts> {
  const [shopRow] = await db.select().from(shop).where(eq(shop.slug, shopSlug)).limit(1)

  if (!shopRow || shopRow.isSuspended) {
    throw new Response(
      JSON.stringify({ error: 'Not Found', message: 'Shop not found or suspended' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return listProductsQuery({ shopSlug }, pagination, 'newest')
}

export type ShopSummary = {
  id: string
  name: string
  description: string | null
  slug: string
}

export async function getShopBySlugQuery(slug: string): Promise<ShopSummary | null> {
  const [shopRow] = await db
    .select({
      id: shop.id,
      name: shop.name,
      description: shop.description,
      slug: shop.slug,
      isSuspended: shop.isSuspended,
    })
    .from(shop)
    .where(eq(shop.slug, slug))
    .limit(1)

  if (!shopRow || shopRow.isSuspended) {
    return null
  }

  const { isSuspended: _, ...summary } = shopRow
  return summary
}

export async function getShopProductsQuery(
  shopSlug: string,
  search?: string,
  pagination: Pagination = { page: 1, pageSize: 20 },
): Promise<PaginatedProducts> {
  const [shopRow] = await db.select().from(shop).where(eq(shop.slug, shopSlug)).limit(1)

  if (!shopRow || shopRow.isSuspended) {
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

  return {
    products: products as PublicProduct[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function listProductsByShopQuery(shopId: string) {
  return db.select().from(product).where(eq(product.shopId, shopId))
}

export async function listProductsByCategorySlugQuery(slug: string) {
  const category = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1)

  if (category.length === 0) {
    return []
  }

  return db
    .select(publicProductColumns)
    .from(product)
    .innerJoin(categories, eq(product.categoryId, categories.id))
    .innerJoin(shop, eq(product.shopId, shop.id))
    .where(
      and(
        eq(product.categoryId, category[0].id),
        eq(shop.isSuspended, false),
        eq(product.isActive, true),
      ),
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
      productCount: count(product.id),
    })
    .from(shop)
    .leftJoin(product, eq(product.shopId, shop.id))
    .where(eq(shop.isSuspended, false))
    .groupBy(shop.id)
    .orderBy(desc(shop.createdAt))
    .limit(limit)

  return result.map((r) => ({
    ...r,
    productCount: Number(r.productCount),
  }))
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

  const { searchProductsMeilisearch } = await import('./meilisearch-products.server')
  const meiliResult = await searchProductsMeilisearch(trimmedQuery || undefined, filters, sort, {
    page,
    pageSize,
  })
  if (meiliResult) {
    return meiliResult
  }

  const offset = (page - 1) * pageSize

  const conditions = [eq(shop.isSuspended, false), eq(product.isActive, true)]

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

  return {
    products: products as PublicProduct[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
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

  const [newProduct] = await db
    .insert(product)
    .values({
      id: crypto.randomUUID(),
      name: data.name.trim(),
      description: data.description?.trim() ?? null,
      slug: data.slug.trim(),
      priceCents: parsePriceToCents(data.price),
      shopId: data.shopId,
      categoryId: data.categoryId ?? null,
    })
    .returning()

  const { syncProductToMeilisearch } = await import('./meilisearch-products.server')
  await syncProductToMeilisearch(newProduct)

  return newProduct
}
