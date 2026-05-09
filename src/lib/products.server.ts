import { and, asc, count, desc, eq, gte, lte } from 'drizzle-orm'
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

export async function listRecentProductsQuery(limit = 8): Promise<PublicProduct[]> {
  const result = await listProductsQuery({}, { page: 1, pageSize: limit }, 'newest')
  return result.products
}

export async function createProductInternal(data: {
  name: string
  description?: string
  slug: string
  price: string
  shopId: string
  categoryId?: string
}) {
  const existing = await db.select().from(product).where(eq(product.slug, data.slug)).limit(1)

  if (existing.length > 0) {
    throw new Error(`A product with slug "${data.slug}" already exists`)
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

  return newProduct
}
