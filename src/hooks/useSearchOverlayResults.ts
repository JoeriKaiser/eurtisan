import { useQuery } from '@tanstack/react-query'
import {
  isMeilisearchClientConfigured,
  meilisearchClient,
  PRODUCTS_INDEX,
} from '#/lib/meilisearch-client'
import { searchProducts } from '#/lib/products'
import { humanizeSlug } from '#/lib/search/suggestions'

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

const EMPTY: OverlayResults = { products: [], total: 0, categories: [] }

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
 * Everything the overlay renders, in one round trip.
 *
 * Previously the overlay issued a browser-side Meilisearch call for suggestions
 * *and* a server round trip (server -> Meilisearch -> PostgreSQL -> image
 * table) for the result cards, on every debounced keystroke. The index now
 * carries the display fields, so a single `multiSearch` covers products,
 * category facets, and engine-side highlighting.
 */
async function fetchOverlayResults(query: string): Promise<OverlayResults> {
  const trimmed = query.trim()
  if (!trimmed) return EMPTY

  if (isMeilisearchClientConfigured() && meilisearchClient) {
    try {
      const response = await meilisearchClient.multiSearch({
        queries: [
          {
            indexUid: PRODUCTS_INDEX,
            q: trimmed,
            limit: 12,
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
      if (!result) return EMPTY

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

      const categories = Object.entries(result.facetDistribution?.categorySlug ?? {})
        .map(([slug, count]) => ({
          slug,
          name: nameBySlug.get(slug) ?? humanizeSlug(slug),
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)

      return { products, total: result.estimatedTotalHits ?? products.length, categories }
    } catch {
      // Fall through to the server path below.
    }
  }

  /* ------------------------------------------------------------------ */
  /*   Server fallback: Meilisearch unreachable or unconfigured client    */
  /* ------------------------------------------------------------------ */

  try {
    const results = await searchProducts({
      data: { query: trimmed, page: 1, pageSize: 12, sort: 'relevance' },
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
  } catch {
    return EMPTY
  }
}

export function useSearchOverlayResults(debouncedQuery: string, enabled: boolean) {
  return useQuery({
    queryKey: ['search-overlay', debouncedQuery],
    queryFn: () => fetchOverlayResults(debouncedQuery),
    enabled: enabled && debouncedQuery.trim().length >= 1,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: (previousData) => previousData,
  })
}
