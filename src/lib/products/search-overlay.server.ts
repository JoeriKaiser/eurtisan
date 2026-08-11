/**
 * Server-side search overlay results.
 *
 * The overlay previously queried Meilisearch directly from the browser with a
 * restricted search key baked into the client bundle. Every search now flows
 * through this server function so the rate limiter, the master key boundary,
 * and the Meilisearch outage fallback all live in one auditable place — and
 * no search credential ships in the JavaScript bundle.
 */
import { meilisearch } from '../meilisearch.server'
import { isMeilisearchHealthy, PRODUCTS_INDEX } from './meilisearch.server'
import { searchProductsQuery } from './operations.server'
import { humanizeSlug } from '../search/suggestions'

export interface OverlayProduct {
  id: string
  name: string
  /** Name with `<em>` highlight markers, or null when highlighting is absent. */
  formattedName: string | null
  description: string | null
  slug: string
  shopSlug: string | null
  shopName: string | null
  categorySlug: string | null
  categoryName: string | null
  priceCents: number
  stockCount: number
  weightGrams: number | null
  volumeMl: number | null
  soldBy: 'weight' | 'volume' | null
  imageUrl: string | null
}

export interface OverlayCategory {
  slug: string
  name: string
  count: number
}

export interface OverlayResults {
  products: OverlayProduct[]
  total: number
  categories: OverlayCategory[]
}

export const EMPTY_OVERLAY_RESULTS: OverlayResults = { products: [], total: 0, categories: [] }

const OVERLAY_PAGE_SIZE = 12

const RETRIEVED_ATTRIBUTES = [
  'id',
  'name',
  'description',
  'slug',
  'shopSlug',
  'shopName',
  'categorySlug',
  'categoryName',
  'priceCents',
  'stockCount',
  'imageUrl',
  'weightGrams',
  'volumeMl',
  'soldBy',
]

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * Everything the overlay renders, in one server round trip.
 *
 * Queries Meilisearch for speed and engine-side highlighting. When Meilisearch
 * is unhealthy or errors, falls back to `searchProductsQuery`, which degrades
 * to the PostgreSQL text search — the same resilience the browser-direct path
 * had, except the IP rate limit now applies before either engine is touched.
 */
export async function searchOverlayQuery(query: string): Promise<OverlayResults> {
  const trimmed = query.trim()
  if (!trimmed) return EMPTY_OVERLAY_RESULTS

  if (meilisearch && (await isMeilisearchHealthy())) {
    try {
      const response = await meilisearch.multiSearch({
        queries: [
          {
            indexUid: PRODUCTS_INDEX,
            q: trimmed,
            limit: OVERLAY_PAGE_SIZE,
            filter: ['isActive = true'],
            facets: ['categorySlug'],
            attributesToRetrieve: RETRIEVED_ATTRIBUTES,
            attributesToHighlight: ['name'],
            highlightPreTag: '<em>',
            highlightPostTag: '</em>',
          },
        ],
      })

      const result = response.results[0]
      if (!result) return EMPTY_OVERLAY_RESULTS

      const products: OverlayProduct[] = result.hits.map((hit) => {
        const doc = hit as Record<string, unknown> & { _formatted?: Record<string, unknown> }
        return {
          id: String(doc.id ?? ''),
          name: String(doc.name ?? ''),
          formattedName: readString(doc._formatted?.name),
          description: readString(doc.description),
          slug: String(doc.slug ?? ''),
          shopSlug: readString(doc.shopSlug),
          shopName: readString(doc.shopName),
          categorySlug: readString(doc.categorySlug),
          categoryName: readString(doc.categoryName),
          priceCents: Number(doc.priceCents ?? 0),
          stockCount: Number(doc.stockCount ?? 0),
          imageUrl: readString(doc.imageUrl),
          weightGrams: typeof doc.weightGrams === 'number' ? doc.weightGrams : null,
          volumeMl: typeof doc.volumeMl === 'number' ? doc.volumeMl : null,
          soldBy: doc.soldBy === 'weight' || doc.soldBy === 'volume' ? doc.soldBy : null,
        }
      })

      // Facet counts key on slug; recover display names from the hits.
      const nameBySlug = new Map<string, string>()
      for (const product of products) {
        if (product.categorySlug && product.categoryName) {
          nameBySlug.set(product.categorySlug, product.categoryName)
        }
      }

      return {
        products,
        total: result.estimatedTotalHits ?? products.length,
        categories: Object.entries(result.facetDistribution?.categorySlug ?? {})
          .map(([slug, count]) => ({
            slug,
            name: nameBySlug.get(slug) ?? humanizeSlug(slug),
            count,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6),
      }
    } catch {
      // Fall through to the resilient query below.
    }
  }

  const results = await searchProductsQuery(trimmed, {}, 'relevance', {
    page: 1,
    pageSize: OVERLAY_PAGE_SIZE,
  })

  const products: OverlayProduct[] = results.products.map((p) => ({
    id: p.id,
    name: p.name,
    formattedName: null,
    description: p.description,
    slug: p.slug,
    shopSlug: p.shopSlug,
    shopName: p.shopName,
    categorySlug: p.categorySlug,
    categoryName: p.categoryName,
    priceCents: p.priceCents,
    stockCount: p.stockCount,
    imageUrl: p.imageUrl,
    weightGrams: p.weightGrams,
    volumeMl: p.volumeMl,
    soldBy: p.soldBy,
  }))

  const counts = new Map<string, { name: string; count: number }>()
  for (const product of products) {
    if (!product.categorySlug) continue
    const existing = counts.get(product.categorySlug)
    counts.set(product.categorySlug, {
      name: product.categoryName ?? existing?.name ?? humanizeSlug(product.categorySlug),
      count: (existing?.count ?? 0) + 1,
    })
  }

  return {
    products,
    total: results.total,
    categories: [...counts.entries()]
      .map(([slug, value]) => ({ slug, name: value.name, count: value.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
  }
}
