import { and, eq, gt, inArray, lte } from 'drizzle-orm'
import { db } from '#/db/index'
import { categories, meilisearchSyncQueue, product, shop } from '#/db/schema'
import { logger } from './logger.server'
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
  slug: string
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

  // Explicitly create/update the index with the primary key 'id' to prevent
  // auto-inference failures when multiple fields in the document end with 'id'.
  try {
    await meilisearch.createIndex(PRODUCTS_INDEX, { primaryKey: 'id' })
  } catch {
    try {
      await meilisearch.index(PRODUCTS_INDEX).update({ primaryKey: 'id' })
    } catch (err) {
      logger.error('Failed to set Meilisearch index primary key', err)
    }
  }

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
    rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
    },
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
      .select({ isSuspended: shop.isSuspended, slug: shop.slug, status: shop.status })
      .from(shop)
      .where(eq(shop.id, productData.shopId))
      .limit(1)

    if (!productData.isActive || shopRow?.isSuspended || shopRow?.status !== 'active') {
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
      slug: productData.slug,
      priceCents: productData.priceCents,
      isActive: productData.isActive,
      shopId: productData.shopId,
      shopSlug: shopRow?.slug ?? '',
      categoryId: productData.categoryId,
      categorySlug: categoryRow[0]?.slug ?? null,
      createdAt: productData.createdAt.toISOString(),
    }

    await meilisearch.index(PRODUCTS_INDEX).addDocuments([doc], { primaryKey: 'id' })
  } catch (err) {
    logger.error('Failed to sync product to Meilisearch', err)
    throw err
  }
}

export async function removeProductFromMeilisearch(productId: string): Promise<void> {
  if (!meilisearch) return
  try {
    await meilisearch.index(PRODUCTS_INDEX).deleteDocument(productId)
  } catch (err) {
    logger.error('Failed to remove product from Meilisearch', err)
    throw err
  }
}

export async function removeShopProductsFromMeilisearch(shopId: string): Promise<void> {
  if (!meilisearch) return
  try {
    await meilisearch.index(PRODUCTS_INDEX).deleteDocuments({
      filter: `shopId = "${shopId}"`,
    })
  } catch (err) {
    logger.error('Failed to remove shop products from Meilisearch', err)
  }
}

export async function clearProductsIndex(): Promise<void> {
  if (!meilisearch) return
  try {
    await meilisearch.index(PRODUCTS_INDEX).deleteAllDocuments()
  } catch (err) {
    logger.error('Failed to clear Meilisearch products index', err)
  }
}

export async function populateProductsIndex(
  batchSize = 500,
): Promise<{ synced: number; errors: number }> {
  if (!meilisearch) return { synced: 0, errors: 0 }
  const client = meilisearch

  let synced = 0
  let errors = 0
  let lastId: string | null = null

  while (true) {
    const conditions = [
      eq(product.isActive, true),
      eq(shop.isSuspended, false),
      eq(shop.status, 'active'),
    ]
    if (lastId !== null) {
      conditions.push(gt(product.id, lastId))
    }

    const products = await db
      .select()
      .from(product)
      .innerJoin(shop, eq(product.shopId, shop.id))
      .where(and(...conditions))
      .orderBy(product.id)
      .limit(batchSize)

    if (products.length === 0) break

    const categoryRows = await Promise.all(
      products.map((p) =>
        p.product.categoryId
          ? db.select().from(categories).where(eq(categories.id, p.product.categoryId)).limit(1)
          : Promise.resolve([]),
      ),
    )

    const docs: MeilisearchProductDocument[] = []
    for (let i = 0; i < products.length; i++) {
      try {
        const p = products[i]
        const prod = p.product
        const categoryRow = categoryRows[i]

        docs.push({
          id: prod.id,
          name: prod.name,
          description: prod.description,
          slug: prod.slug,
          priceCents: prod.priceCents,
          isActive: prod.isActive,
          shopId: prod.shopId,
          shopSlug: p.shop.slug,
          categoryId: prod.categoryId,
          categorySlug: categoryRow[0]?.slug ?? null,
          createdAt: prod.createdAt.toISOString(),
        })
      } catch {
        errors++
      }
    }

    if (docs.length > 0) {
      await client.index(PRODUCTS_INDEX).addDocuments(docs, { primaryKey: 'id' })
      synced += docs.length
    }

    if (products.length < batchSize) break
    lastId = products[products.length - 1].product.id
  }

  return { synced, errors }
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
        shopIsVatRegistered: shop.isVatRegistered,
      })
      .from(product)
      .innerJoin(shop, eq(product.shopId, shop.id))
      .leftJoin(categories, eq(product.categoryId, categories.id))
      .where(
        and(
          eq(shop.status, 'active'),
          eq(shop.isSuspended, false),
          eq(product.isActive, true),
          inArray(product.id, ids),
        ),
      )

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
    logger.error('Meilisearch search failed, falling back to PostgreSQL', err)
    return null
  }
}

export async function processMeilisearchSyncQueue(
  batchSize = 50,
): Promise<{ processedCount: number }> {
  const queueItems = await db
    .select()
    .from(meilisearchSyncQueue)
    .where(
      and(eq(meilisearchSyncQueue.status, 'pending'), lte(meilisearchSyncQueue.runAt, new Date())),
    )
    .orderBy(meilisearchSyncQueue.createdAt)
    .limit(batchSize)

  if (queueItems.length === 0) {
    return { processedCount: 0 }
  }

  await Promise.all(
    queueItems.map(async (item) => {
      try {
        if (item.action === 'index') {
          const [prod] = await db
            .select()
            .from(product)
            .where(eq(product.id, item.productId))
            .limit(1)
          if (!prod) {
            await removeProductFromMeilisearch(item.productId)
          } else {
            await syncProductToMeilisearch(prod)
          }
        } else if (item.action === 'delete') {
          await removeProductFromMeilisearch(item.productId)
        }

        await db
          .update(meilisearchSyncQueue)
          .set({
            status: 'completed',
            updatedAt: new Date(),
          })
          .where(eq(meilisearchSyncQueue.id, item.id))
      } catch (err: any) {
        const attempts = item.attempts + 1
        const lastError = err?.message || String(err)
        const backoffSec = 2 ** attempts * 5
        const runAt = new Date(Date.now() + backoffSec * 1000)

        await db
          .update(meilisearchSyncQueue)
          .set({
            attempts,
            lastError,
            runAt,
            status: attempts >= 5 ? 'failed' : 'pending',
            updatedAt: new Date(),
          })
          .where(eq(meilisearchSyncQueue.id, item.id))

        logger.error(
          `[meilisearch-sync] Error processing item ${item.id} (attempt ${attempts})`,
          err,
        )
      }
    }),
  )

  return { processedCount: queueItems.length }
}
