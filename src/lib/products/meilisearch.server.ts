import { and, eq, gt, inArray, lte } from 'drizzle-orm'
import { db } from '#/db/index'
import { categories, meilisearchSyncQueue, product, shop } from '#/db/schema'
import { logger } from '../logger.server'
import { meilisearchSyncQueueFailedTotal } from '../metrics.server'
import { isMeilisearchConfigured, meilisearch } from '../meilisearch.server'
import { escapeFilterValue } from '../search/utils'
import { fetchFirstImageUrls } from './operations.server'
import type { PaginatedProducts, PublicProduct, SearchFilters, SearchSortOption } from './types'

export const PRODUCTS_INDEX = 'products'

/**
 * Upper bound on results Meilisearch will paginate through. The engine default
 * is 1000, which silently truncates both `totalHits` and any page past
 * ceil(1000 / pageSize) once the catalogue outgrows it.
 */
export const MAX_TOTAL_HITS = 10_000

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
    pagination: { maxTotalHits: MAX_TOTAL_HITS },
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
  status: 'draft' | 'published' | 'archived'
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

    if (
      productData.status !== 'published' ||
      !productData.isActive ||
      shopRow?.isSuspended ||
      shopRow?.status !== 'active'
    ) {
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
      filter: `shopId = "${escapeFilterValue(shopId)}"`,
    })
  } catch (err) {
    // Rethrow so callers can retry: a suspended shop whose listings stay in the
    // index remains publicly searchable, which must never fail silently.
    logger.error('Failed to remove shop products from Meilisearch', err)
    throw err
  }
}

/**
 * Delete documents that Meilisearch still returns but that no longer satisfy
 * the index invariant (published, active, non-suspended shop). Never rejects —
 * this is best-effort self-healing on the read path.
 */
async function purgeStaleDocuments(productIds: string[]): Promise<void> {
  if (!meilisearch || productIds.length === 0) return
  try {
    await meilisearch.index(PRODUCTS_INDEX).deleteDocuments(productIds)
  } catch (err) {
    logger.error('Failed to purge stale Meilisearch documents', err)
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
      eq(product.status, 'published'),
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

    const categoryIds = [
      ...new Set(
        products.map((row) => row.product.categoryId).filter((id): id is string => id != null),
      ),
    ]
    const categoryRows =
      categoryIds.length > 0
        ? await db
            .select({ id: categories.id, slug: categories.slug })
            .from(categories)
            .where(inArray(categories.id, categoryIds))
        : []
    const categorySlugById = new Map(categoryRows.map((c) => [c.id, c.slug]))

    const docs: MeilisearchProductDocument[] = []
    for (const row of products) {
      try {
        const prod = row.product

        docs.push({
          id: prod.id,
          name: prod.name,
          description: prod.description,
          slug: prod.slug,
          priceCents: prod.priceCents,
          isActive: prod.isActive,
          shopId: prod.shopId,
          shopSlug: row.shop.slug,
          categoryId: prod.categoryId,
          categorySlug: prod.categoryId ? (categorySlugById.get(prod.categoryId) ?? null) : null,
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
    meiliFilters.push(`shopSlug = "${escapeFilterValue(filters.shopSlug)}"`)
  }

  if (filters.categorySlug) {
    meiliFilters.push(`categorySlug = "${escapeFilterValue(filters.categorySlug)}"`)
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
    // `page`/`hitsPerPage` selects Meilisearch's finite pagination mode, which
    // returns an exact `totalHits` instead of the `estimatedTotalHits` produced
    // by `limit`/`offset`. Page counts derived from an estimate are wrong.
    const result = await meilisearch.index(PRODUCTS_INDEX).search(query ?? '', {
      filter: meiliFilters,
      sort: meiliSort.length > 0 ? meiliSort : undefined,
      page,
      hitsPerPage: pageSize,
      attributesToRetrieve: ['id'],
    })

    const hits = result.hits as Array<{ id: string }>
    const reportedTotal = typeof result.totalHits === 'number' ? result.totalHits : hits.length

    if (hits.length === 0) {
      return {
        products: [],
        total: reportedTotal,
        page,
        pageSize,
        totalPages: Math.ceil(reportedTotal / pageSize),
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
          eq(product.status, 'published'),
          eq(product.isActive, true),
          inArray(product.id, ids),
        ),
      )

    const rowMap = new Map(rows.map((r) => [r.id, r]))
    const orderedRows = ids.map((id) => rowMap.get(id)).filter((p) => p !== undefined)
    const staleIds = ids.filter((id) => !rowMap.has(id))

    // Every hit on this page is stale: the index is badly desynced, so the
    // PostgreSQL path will give a materially better answer than an empty page.
    if (orderedRows.length === 0) {
      logger.warn('Meilisearch returned only stale hits; falling back to PostgreSQL', {
        query,
        expectedHits: hits.length,
      })
      void purgeStaleDocuments(staleIds)
      return null
    }

    // A partially stale page is common and self-correcting: drop the dead hits,
    // schedule their removal, and serve the rest rather than discarding a good
    // result set and re-running the whole search against PostgreSQL.
    if (staleIds.length > 0) {
      logger.warn('Meilisearch returned stale hits; serving hydrated subset', {
        query,
        expectedHits: hits.length,
        hydratedHits: orderedRows.length,
      })
      void purgeStaleDocuments(staleIds)
    }

    const total = Math.max(orderedRows.length, reportedTotal - staleIds.length)

    const imageUrls = await fetchFirstImageUrls(orderedRows.map((p) => p.id))
    const orderedProducts = orderedRows.map((p) => ({
      ...p,
      imageUrl: imageUrls.get(p.id) ?? null,
    })) as PublicProduct[]

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

        await db.delete(meilisearchSyncQueue).where(eq(meilisearchSyncQueue.id, item.id))
      } catch (err: unknown) {
        const attempts = item.attempts + 1
        const lastError = err instanceof Error ? err.message : String(err)
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

        if (attempts >= 5) {
          meilisearchSyncQueueFailedTotal.inc()
          logger.error('Meilisearch sync queue item failed permanently', undefined, {
            alert: true,
            productId: item.productId,
            queueId: item.id,
          })
        }

        logger.error(
          `[meilisearch-sync] Error processing item ${item.id} (attempt ${attempts})`,
          err,
        )
      }
    }),
  )

  return { processedCount: queueItems.length }
}
