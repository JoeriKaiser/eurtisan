import { and, count, eq, gt, inArray, lte, sum } from 'drizzle-orm'
import { db } from '#/db/index'
import { categories, meilisearchSyncQueue, product, review, shop } from '#/db/schema'
import { logger } from '../logger.server'
import { meilisearchSyncQueueFailedTotal } from '../metrics.server'
import { isMeilisearchConfigured, meilisearch } from '../meilisearch.server'
import type { ReviewAggregate } from '../search/relevance'
import { computePopularityScore, computeRatingAverage } from '../search/relevance'
import { PRODUCT_SYNONYMS } from '../search/synonyms'
import { escapeFilterValue } from '../search/utils'
import { fetchFirstImageUrls } from './operations.server'
import type {
  PaginatedProducts,
  PublicProduct,
  SearchFacets,
  SearchFilters,
  SearchSortOption,
} from './types'

const EMPTY_AGGREGATE: ReviewAggregate = { reviewCount: 0, ratingSum: 0 }

/**
 * Approved-review totals per product. Flagged and hidden reviews must not
 * influence ranking, so they are excluded here rather than at read time.
 */
async function fetchReviewAggregates(productIds: string[]): Promise<Map<string, ReviewAggregate>> {
  if (productIds.length === 0) return new Map()

  const rows = await db
    .select({
      productId: review.productId,
      reviewCount: count(),
      ratingSum: sum(review.rating),
    })
    .from(review)
    .where(and(eq(review.moderationStatus, 'approved'), inArray(review.productId, productIds)))
    .groupBy(review.productId)

  return new Map(
    rows.map((row) => [
      row.productId,
      {
        reviewCount: Number(row.reviewCount ?? 0),
        // `sum` returns a numeric string in postgres.
        ratingSum: Number(row.ratingSum ?? 0),
      },
    ]),
  )
}

/** Build the relevance-signal portion of a document from its review totals. */
function buildRelevanceFields(stockCount: number, aggregate: ReviewAggregate) {
  return {
    stockCount,
    inStock: stockCount > 0,
    inStockRank: stockCount > 0 ? 1 : 0,
    ratingAverage: computeRatingAverage(aggregate),
    reviewCount: aggregate.reviewCount,
    popularityScore: computePopularityScore(aggregate),
  }
}

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
  /** Searchable: buyers look for products by the shop that makes them. */
  shopName: string
  categoryId: string | null
  categorySlug: string | null
  /** Searchable: "earrings" should match a listing only categorised as such. */
  categoryName: string | null
  stockCount: number
  inStock: boolean
  /** 1 when in stock, 0 otherwise. Custom ranking rules require a number. */
  inStockRank: number
  ratingAverage: number
  reviewCount: number
  popularityScore: number
  /**
   * Primary thumbnail, so the search overlay can render a complete result card
   * from the index alone. Images only change through product create/update,
   * both of which already enqueue a reindex.
   */
  imageUrl: string | null
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
    // Order is significant: the `attribute` ranking rule weights earlier
    // attributes more heavily, so a query matching a product name outranks the
    // same query matching a description.
    searchableAttributes: ['name', 'shopName', 'categoryName', 'description'],
    filterableAttributes: [
      'categoryId',
      'shopId',
      'priceCents',
      'isActive',
      'shopSlug',
      'categorySlug',
      'inStock',
      'stockCount',
    ],
    sortableAttributes: ['priceCents', 'createdAt', 'popularityScore', 'ratingAverage'],
    // Custom rules come last so they break ties between equally relevant
    // matches rather than overriding text relevance: in-stock first, then the
    // better-reviewed product.
    rankingRules: [
      'words',
      'typo',
      'proximity',
      'attribute',
      'sort',
      'exactness',
      'inStockRank:desc',
      'popularityScore:desc',
    ],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
    },
    pagination: { maxTotalHits: MAX_TOTAL_HITS },
    synonyms: PRODUCT_SYNONYMS,
    // Listings are written in either language, so both tokenizers apply to
    // every text field rather than defaulting to English segmentation.
    localizedAttributes: [
      {
        locales: ['eng', 'nld'],
        attributePatterns: ['name', 'description', 'categoryName', 'shopName'],
      },
    ],
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
      .select({
        isSuspended: shop.isSuspended,
        slug: shop.slug,
        name: shop.name,
        status: shop.status,
      })
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

    const [categoryRow, aggregates, imageUrls] = await Promise.all([
      productData.categoryId
        ? db
            .select({ slug: categories.slug, name: categories.name })
            .from(categories)
            .where(eq(categories.id, productData.categoryId))
            .limit(1)
        : Promise.resolve([]),
      fetchReviewAggregates([productData.id]),
      fetchFirstImageUrls([productData.id]),
    ])

    const doc: MeilisearchProductDocument = {
      id: productData.id,
      name: productData.name,
      description: productData.description,
      slug: productData.slug,
      priceCents: productData.priceCents,
      isActive: productData.isActive,
      shopId: productData.shopId,
      shopSlug: shopRow?.slug ?? '',
      shopName: shopRow?.name ?? '',
      categoryId: productData.categoryId,
      categorySlug: categoryRow[0]?.slug ?? null,
      categoryName: categoryRow[0]?.name ?? null,
      ...buildRelevanceFields(
        productData.stockCount,
        aggregates.get(productData.id) ?? EMPTY_AGGREGATE,
      ),
      imageUrl: imageUrls.get(productData.id) ?? null,
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
 * Normalise Meilisearch's facet payload into the shape the UI consumes.
 *
 * Counts describe the whole filtered result set, not the current page, which is
 * what makes them usable as "23 in Pottery" hints next to each filter option.
 */
function extractFacets(
  distribution: Record<string, Record<string, number>> | undefined,
  stats: Record<string, { min: number; max: number }> | undefined,
): SearchFacets {
  const priceStats = stats?.priceCents
  return {
    categorySlug: distribution?.categorySlug ?? {},
    inStock: distribution?.inStock ?? {},
    priceCents: priceStats ? { min: priceStats.min, max: priceStats.max } : null,
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
    const [categoryRows, aggregates, imageUrls] = await Promise.all([
      categoryIds.length > 0
        ? db
            .select({ id: categories.id, slug: categories.slug, name: categories.name })
            .from(categories)
            .where(inArray(categories.id, categoryIds))
        : Promise.resolve([]),
      fetchReviewAggregates(products.map((row) => row.product.id)),
      fetchFirstImageUrls(products.map((row) => row.product.id)),
    ])
    const categoryById = new Map(categoryRows.map((c) => [c.id, c]))

    const docs: MeilisearchProductDocument[] = []
    for (const row of products) {
      try {
        const prod = row.product
        const category = prod.categoryId ? categoryById.get(prod.categoryId) : undefined

        docs.push({
          id: prod.id,
          name: prod.name,
          description: prod.description,
          slug: prod.slug,
          priceCents: prod.priceCents,
          isActive: prod.isActive,
          shopId: prod.shopId,
          shopSlug: row.shop.slug,
          shopName: row.shop.name,
          categoryId: prod.categoryId,
          categorySlug: category?.slug ?? null,
          categoryName: category?.name ?? null,
          ...buildRelevanceFields(prod.stockCount, aggregates.get(prod.id) ?? EMPTY_AGGREGATE),
          imageUrl: imageUrls.get(prod.id) ?? null,
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

  if (filters.inStockOnly) {
    meiliFilters.push('inStock = true')
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
      facets: ['categorySlug', 'inStock', 'priceCents'],
    })

    const hits = result.hits as Array<{ id: string }>
    const reportedTotal = typeof result.totalHits === 'number' ? result.totalHits : hits.length
    const facets = extractFacets(result.facetDistribution, result.facetStats)

    if (hits.length === 0) {
      return {
        products: [],
        total: reportedTotal,
        page,
        pageSize,
        totalPages: Math.ceil(reportedTotal / pageSize),
        facets,
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
      facets,
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
