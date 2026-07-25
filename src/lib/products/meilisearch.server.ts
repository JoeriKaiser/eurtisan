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

/** A product joined to its shop, as returned by the indexing queries. */
type ProductWithShop = {
  product: typeof product.$inferSelect
  shop: typeof shop.$inferSelect
}

/**
 * Build index documents for a batch of product rows.
 *
 * Single definition of the document shape, shared by the full rebuild and the
 * incremental sync queue, with all enrichment (category, review totals,
 * thumbnail) fetched in one round trip per batch rather than per product.
 */
async function buildProductDocuments(
  rows: ProductWithShop[],
): Promise<MeilisearchProductDocument[]> {
  if (rows.length === 0) return []

  const productIds = rows.map((row) => row.product.id)
  const categoryIds = [
    ...new Set(rows.map((row) => row.product.categoryId).filter((id): id is string => id != null)),
  ]

  const [categoryRows, aggregates, imageUrls] = await Promise.all([
    categoryIds.length > 0
      ? db
          .select({ id: categories.id, slug: categories.slug, name: categories.name })
          .from(categories)
          .where(inArray(categories.id, categoryIds))
      : Promise.resolve([]),
    fetchReviewAggregates(productIds),
    fetchFirstImageUrls(productIds),
  ])
  const categoryById = new Map(categoryRows.map((c) => [c.id, c]))

  return rows.map((row) => {
    const prod = row.product
    const category = prod.categoryId ? categoryById.get(prod.categoryId) : undefined

    return {
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
    }
  })
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

export async function configureProductsIndex(indexUid: string = PRODUCTS_INDEX): Promise<void> {
  if (!meilisearch) return

  // Explicitly create/update the index with the primary key 'id' to prevent
  // auto-inference failures when multiple fields in the document end with 'id'.
  try {
    await meilisearch.createIndex(indexUid, { primaryKey: 'id' })
  } catch {
    try {
      await meilisearch.index(indexUid).update({ primaryKey: 'id' })
    } catch (err) {
      logger.error('Failed to set Meilisearch index primary key', err)
    }
  }

  const index = meilisearch.index(indexUid)
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
  indexUid: string = PRODUCTS_INDEX,
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

    const docs = await buildProductDocuments(products)
    errors += products.length - docs.length

    if (docs.length > 0) {
      await client.index(indexUid).addDocuments(docs, { primaryKey: 'id' })
      synced += docs.length
    }

    if (products.length < batchSize) break
    lastId = products[products.length - 1].product.id
  }

  return { synced, errors }
}

/**
 * Rebuild the products index without downtime.
 *
 * `clearProductsIndex` + `populateProductsIndex` leaves search returning
 * nothing for the whole rebuild, which on a marketplace means an empty
 * storefront. Instead build a fresh index alongside the live one and swap them
 * atomically, so readers only ever see a complete index.
 *
 * Returns null when Meilisearch is not configured.
 */
export async function rebuildProductsIndex(
  batchSize = 500,
): Promise<{ synced: number; errors: number } | null> {
  if (!meilisearch) return null
  const client = meilisearch

  // A fixed name (rather than a timestamp) means a crashed rebuild leaves one
  // recoverable index behind instead of accumulating them.
  const stagingUid = `${PRODUCTS_INDEX}_rebuild`

  logger.info('[meilisearch] Rebuilding products index', { stagingUid })

  // Start from empty in case a previous rebuild died partway through.
  try {
    await client.tasks.waitForTask(await client.deleteIndex(stagingUid))
  } catch {
    // The staging index normally does not exist; that is the expected case.
  }

  await configureProductsIndex(stagingUid)
  const result = await populateProductsIndex(batchSize, stagingUid)

  // addDocuments only enqueues work — the swap must not happen until the
  // staging index has actually finished indexing.
  await client.tasks.waitForTask(
    await client.index(stagingUid).updateSettings({ pagination: { maxTotalHits: MAX_TOTAL_HITS } }),
  )

  // `rename: false` is a true swap: the live uid keeps serving throughout and
  // ends up pointing at the freshly built data.
  await client.tasks.waitForTask(
    await client.swapIndexes([{ indexes: [PRODUCTS_INDEX, stagingUid], rename: false }]),
  )

  // After the swap, `stagingUid` holds the previous generation.
  try {
    await client.tasks.waitForTask(await client.deleteIndex(stagingUid))
  } catch (err) {
    logger.error('Failed to delete the superseded Meilisearch index', err)
  }

  logger.info('[meilisearch] Products index rebuilt', {
    synced: result.synced,
    errors: result.errors,
  })

  return result
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
      // The raw query is deliberately omitted: search terms are user-typed free
      // text under a retention policy, and application logs are not covered by
      // it. The stale ids are the actionable part anyway.
      logger.warn('Meilisearch returned only stale hits; falling back to PostgreSQL', {
        expectedHits: hits.length,
        staleIds,
      })
      void purgeStaleDocuments(staleIds)
      return null
    }

    // A partially stale page is common and self-correcting: drop the dead hits,
    // schedule their removal, and serve the rest rather than discarding a good
    // result set and re-running the whole search against PostgreSQL.
    if (staleIds.length > 0) {
      logger.warn('Meilisearch returned stale hits; serving hydrated subset', {
        expectedHits: hits.length,
        hydratedHits: orderedRows.length,
        staleIds,
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

  try {
    await processQueueBatch(queueItems)
  } catch (err) {
    // A batch write is all-or-nothing, so one bad row would otherwise stall
    // every item behind it. Fall back to per-item processing to isolate the
    // offender and let the rest through.
    logger.warn('[meilisearch-sync] Batch write failed; retrying items individually', {
      batchSize: queueItems.length,
      error: err instanceof Error ? err.message : String(err),
    })
    for (const item of queueItems) {
      await processQueueItem(item)
    }
  }

  return { processedCount: queueItems.length }
}

type SyncQueueItem = typeof meilisearchSyncQueue.$inferSelect

/**
 * Apply a whole batch with one write per operation type.
 *
 * The previous implementation issued an `addDocuments` call per row — fifty
 * separate Meilisearch tasks per tick, each preceded by its own shop and
 * category lookup.
 */
async function processQueueBatch(items: SyncQueueItem[]): Promise<void> {
  if (!meilisearch) {
    // Nothing to sync to; drop the rows so the queue does not grow unbounded.
    await db.delete(meilisearchSyncQueue).where(
      inArray(
        meilisearchSyncQueue.id,
        items.map((item) => item.id),
      ),
    )
    return
  }

  const indexIds = [...new Set(items.filter((i) => i.action === 'index').map((i) => i.productId))]
  const deleteIds = new Set(items.filter((i) => i.action === 'delete').map((i) => i.productId))

  // Only products still satisfying the index invariant may be written; the rest
  // are removed, which also covers rows deleted since they were enqueued.
  const rows =
    indexIds.length > 0
      ? await db
          .select()
          .from(product)
          .innerJoin(shop, eq(product.shopId, shop.id))
          .where(
            and(
              inArray(product.id, indexIds),
              eq(product.status, 'published'),
              eq(product.isActive, true),
              eq(shop.isSuspended, false),
              eq(shop.status, 'active'),
            ),
          )
      : []

  const indexableIds = new Set(rows.map((row) => row.product.id))
  for (const id of indexIds) {
    if (!indexableIds.has(id)) deleteIds.add(id)
  }

  const docs = await buildProductDocuments(rows)

  if (docs.length > 0) {
    await meilisearch.index(PRODUCTS_INDEX).addDocuments(docs, { primaryKey: 'id' })
  }
  if (deleteIds.size > 0) {
    await meilisearch.index(PRODUCTS_INDEX).deleteDocuments([...deleteIds])
  }

  await db.delete(meilisearchSyncQueue).where(
    inArray(
      meilisearchSyncQueue.id,
      items.map((item) => item.id),
    ),
  )
}

/** Process a single queue row, recording backoff on failure. */
async function processQueueItem(item: SyncQueueItem): Promise<void> {
  try {
    if (item.action === 'index') {
      const [prod] = await db.select().from(product).where(eq(product.id, item.productId)).limit(1)
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

    logger.error(`[meilisearch-sync] Error processing item ${item.id} (attempt ${attempts})`, err)
  }
}
