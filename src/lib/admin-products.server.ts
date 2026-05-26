import { and, count, desc, eq, gte, ilike, inArray, lte, or } from 'drizzle-orm'
import { db } from '#/db/index'
import { categories, product, productImage, shop } from '#/db/schema'

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export interface AdminProductListItem {
  id: string
  name: string
  slug: string
  priceCents: number
  stockCount: number
  isActive: boolean
  shopId: string
  shopName: string
  shopSlug: string
  categoryId: string | null
  categoryName: string | null
  createdAt: Date
  thumbnailUrl: string | null
}

export interface PaginatedProducts {
  products: AdminProductListItem[]
  total: number
  page: number
  pageSize: number
}

/* -------------------------------------------------------------------------- */
/*                          List All Products Query                           */
/* -------------------------------------------------------------------------- */

export async function listAllProductsQuery(params: {
  query?: string
  shopId?: string
  categoryId?: string
  status?: 'active' | 'inactive'
  minPriceCents?: number
  maxPriceCents?: number
  page: number
  pageSize: number
}): Promise<PaginatedProducts> {
  const { query, shopId, categoryId, status, minPriceCents, maxPriceCents, page, pageSize } = params
  const offset = (page - 1) * pageSize

  const conditions = []

  if (query) {
    const pattern = `%${query}%`
    conditions.push(or(ilike(product.name, pattern), ilike(shop.name, pattern)))
  }

  if (shopId) {
    conditions.push(eq(product.shopId, shopId))
  }

  if (categoryId) {
    conditions.push(eq(product.categoryId, categoryId))
  }

  if (status === 'active') {
    conditions.push(eq(product.isActive, true))
  } else if (status === 'inactive') {
    conditions.push(eq(product.isActive, false))
  }

  if (minPriceCents !== undefined) {
    conditions.push(gte(product.priceCents, minPriceCents))
  }
  if (maxPriceCents !== undefined) {
    conditions.push(lte(product.priceCents, maxPriceCents))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: product.id,
        name: product.name,
        slug: product.slug,
        priceCents: product.priceCents,
        stockCount: product.stockCount,
        isActive: product.isActive,
        shopId: product.shopId,
        shopName: shop.name,
        shopSlug: shop.slug,
        categoryId: product.categoryId,
        categoryName: categories.name,
        createdAt: product.createdAt,
      })
      .from(product)
      .innerJoin(shop, eq(product.shopId, shop.id))
      .leftJoin(categories, eq(product.categoryId, categories.id))
      .where(where)
      .orderBy(desc(product.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: count() })
      .from(product)
      .innerJoin(shop, eq(product.shopId, shop.id))
      .leftJoin(categories, eq(product.categoryId, categories.id))
      .where(where),
  ])

  // Fetch thumbnails
  const thumbnailMap = new Map<string, string>()
  if (rows.length > 0) {
    const productIds = rows.map((r) => r.id)
    const thumbnails = await db
      .select({ productId: productImage.productId, url: productImage.url })
      .from(productImage)
      .where(and(inArray(productImage.productId, productIds), eq(productImage.sortOrder, 0)))
    for (const thumb of thumbnails) {
      thumbnailMap.set(thumb.productId, thumb.url)
    }
  }

  return {
    products: rows.map((r) => ({
      ...r,
      thumbnailUrl: thumbnailMap.get(r.id) ?? null,
    })),
    total: Number(totalResult[0]?.count ?? 0),
    page,
    pageSize,
  }
}

/* -------------------------------------------------------------------------- */
/*                           Toggle Product Active                            */
/* -------------------------------------------------------------------------- */

export async function toggleProductActiveQuery(
  productId: string,
): Promise<{ id: string; isActive: boolean }> {
  const [record] = await db.select().from(product).where(eq(product.id, productId)).limit(1)

  if (!record) {
    throw new Error('Product not found')
  }

  const newActive = !record.isActive

  const [updated] = await db
    .update(product)
    .set({ isActive: newActive, updatedAt: new Date() })
    .where(eq(product.id, productId))
    .returning({ id: product.id, isActive: product.isActive })

  // Sync to Meilisearch
  try {
    const { syncProductToMeilisearch } = await import('./meilisearch-products.server')
    await syncProductToMeilisearch({ ...record, isActive: newActive })
  } catch {
    // Meilisearch sync failures must not break the admin toggle
  }

  return updated
}
