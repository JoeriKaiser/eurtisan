import { and, eq, inArray } from 'drizzle-orm'
import { db } from '#/db/index'
import { categories, product, shop } from '#/db/schema'
import { isMeilisearchConfigured, meilisearch } from './meilisearch.server'
import type {
  PaginatedProducts,
  PublicProduct,
  SearchFilters,
  SearchSortOption,
} from './products.server'

export const PRODUCTS_INDEX = 'products'

export interface MeilisearchProductDocument {
  id: string
  name: string
  description: string | null
  priceCents: number
  isActive: boolean
  shopId: string
  shopSlug: string
  categoryId: string | null
  categorySlug: string | null
  createdAt: string
}

export async function isMeilisearchHealthy(): Promise<boolean> {
  if (!isMeilisearchConfigured() || !meilisearch) return false
  try {
    const health = await meilisearch.health()
    return health.status === 'available'
  } catch {
    return false
  }
}

export async function configureProductsIndex(): Promise<void> {
  if (!meilisearch) return
  const index = meilisearch.index(PRODUCTS_INDEX)
  await index.updateSettings({
    searchableAttributes: ['name', 'description'],
    filterableAttributes: [
      'categoryId',
      'shopId',
      'priceCents',
      'isActive',
      'shopSlug',
      'categorySlug',
    ],
    sortableAttributes: ['priceCents', 'createdAt'],
  })
}

export async function syncProductToMeilisearch(productData: {
  id: string
  name: string
  description: string | null
  slug: string
  priceCents: number
  stockCount: number
  isActive: boolean
  shopId: string
  categoryId: string | null
  createdAt: Date
  updatedAt: Date
}): Promise<void> {
  if (!meilisearch) return
  try {
    const [shopRow] = await db
      .select({ isSuspended: shop.isSuspended, slug: shop.slug })
      .from(shop)
      .where(eq(shop.id, productData.shopId))
      .limit(1)

    if (!productData.isActive || shopRow?.isSuspended) {
      await meilisearch.index(PRODUCTS_INDEX).deleteDocument(productData.id)
      return
    }

    const categoryRow = productData.categoryId
      ? await db.select().from(categories).where(eq(categories.id, productData.categoryId)).limit(1)
      : []

    const doc: MeilisearchProductDocument = {
      id: productData.id,
      name: productData.name,
      description: productData.description,
      priceCents: productData.priceCents,
      isActive: productData.isActive,
      shopId: productData.shopId,
      shopSlug: shopRow?.slug ?? '',
      categoryId: productData.categoryId,
      categorySlug: categoryRow[0]?.slug ?? null,
      createdAt: productData.createdAt.toISOString(),
    }

    await meilisearch.index(PRODUCTS_INDEX).addDocuments([doc])
  } catch (err) {
    console.error('Failed to sync product to Meilisearch:', err)
  }
}

export async function removeProductFromMeilisearch(productId: string): Promise<void> {
  if (!meilisearch) return
  try {
    await meilisearch.index(PRODUCTS_INDEX).deleteDocument(productId)
  } catch (err) {
    console.error('Failed to remove product from Meilisearch:', err)
  }
}

export async function removeShopProductsFromMeilisearch(shopId: string): Promise<void> {
  if (!meilisearch) return
  try {
    await meilisearch.index(PRODUCTS_INDEX).deleteDocuments({
      filter: `shopId = "${shopId}"`,
    })
  } catch (err) {
    console.error('Failed to remove shop products from Meilisearch:', err)
  }
}

export async function populateProductsIndex(): Promise<{ synced: number; errors: number }> {
  if (!meilisearch) return { synced: 0, errors: 0 }

  const products = await db
    .select()
    .from(product)
    .innerJoin(shop, eq(product.shopId, shop.id))
    .where(and(eq(product.isActive, true), eq(shop.isSuspended, false)))

  const docs: MeilisearchProductDocument[] = []
  let errors = 0

  for (const p of products) {
    try {
      const categoryRow = p.product.categoryId
        ? await db.select().from(categories).where(eq(categories.id, p.product.categoryId)).limit(1)
        : []

      docs.push({
        id: p.product.id,
        name: p.product.name,
        description: p.product.description,
        priceCents: p.product.priceCents,
        isActive: p.product.isActive,
        shopId: p.product.shopId,
        shopSlug: p.shop.slug,
        categoryId: p.product.categoryId,
        categorySlug: categoryRow[0]?.slug ?? null,
        createdAt: p.product.createdAt.toISOString(),
      })
    } catch {
      errors++
    }
  }

  if (docs.length > 0) {
    const BATCH_SIZE = 500
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE)
      await meilisearch.index(PRODUCTS_INDEX).addDocuments(batch)
    }
  }

  return { synced: docs.length, errors }
}

export async function searchProductsMeilisearch(
  query: string | undefined,
  filters: SearchFilters,
  sort: SearchSortOption,
  pagination: { page: number; pageSize: number },
): Promise<PaginatedProducts | null> {
  if (!meilisearch || !(await isMeilisearchHealthy())) return null

  const page = Math.max(1, pagination.page)
  const pageSize = Math.min(100, Math.max(1, pagination.pageSize))

  const meiliFilters: string[] = ['isActive = true']

  if (filters.shopSlug) {
    meiliFilters.push(`shopSlug = "${filters.shopSlug}"`)
  }

  if (filters.categorySlug) {
    meiliFilters.push(`categorySlug = "${filters.categorySlug}"`)
  }

  if (filters.minPriceCents !== undefined) {
    meiliFilters.push(`priceCents >= ${filters.minPriceCents}`)
  }

  if (filters.maxPriceCents !== undefined) {
    meiliFilters.push(`priceCents <= ${filters.maxPriceCents}`)
  }

  const meiliSort: string[] = []
  switch (sort) {
    case 'price_asc':
      meiliSort.push('priceCents:asc')
      break
    case 'price_desc':
      meiliSort.push('priceCents:desc')
      break
    case 'newest':
      meiliSort.push('createdAt:desc')
      break
    default:
      break
  }

  try {
    const result = await meilisearch.index(PRODUCTS_INDEX).search(query ?? '', {
      filter: meiliFilters,
      sort: meiliSort.length > 0 ? meiliSort : undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      attributesToRetrieve: ['id'],
    })

    const hits = result.hits as Array<{ id: string }>
    const total = result.estimatedTotalHits ?? hits.length

    if (hits.length === 0) {
      return {
        products: [],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      }
    }

    const ids = hits.map((h) => h.id)

    const rows = await db
      .select({
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
      })
      .from(product)
      .innerJoin(shop, eq(product.shopId, shop.id))
      .leftJoin(categories, eq(product.categoryId, categories.id))
      .where(and(eq(shop.isSuspended, false), eq(product.isActive, true), inArray(product.id, ids)))

    const rowMap = new Map(rows.map((r) => [r.id, r]))
    const orderedProducts = ids
      .map((id) => rowMap.get(id))
      .filter((p) => p !== undefined) as PublicProduct[]

    return {
      products: orderedProducts,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  } catch (err) {
    console.error('Meilisearch search failed, falling back to PostgreSQL:', err)
    return null
  }
}
