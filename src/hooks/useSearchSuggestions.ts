import { useQuery } from '@tanstack/react-query'
import {
  isMeilisearchClientConfigured,
  meilisearchClient,
  PRODUCTS_INDEX,
} from '#/lib/meilisearch-client'
import { searchSuggestionsFallback } from '#/lib/products'

export interface SearchSuggestion {
  type: 'query' | 'product' | 'category'
  label: string
  href?: string
  slug?: string
}

async function fetchSuggestions(query: string): Promise<SearchSuggestion[]> {
  if (query.trim().length < 1) {
    return []
  }

  const buildSuggestions = (
    query: string,
    hits: Array<{
      name: string
      slug: string
      shopSlug: string | null
      categorySlug: string | null
    }>,
  ): SearchSuggestion[] => {
    const suggestions: SearchSuggestion[] = []
    const seenLabels = new Set<string>()

    suggestions.push({ type: 'query', label: query })
    seenLabels.add(query.toLowerCase())

    const categories = new Map<string, string>()

    for (const hit of hits) {
      const name = hit.name
      const slug = hit.slug
      const shopSlug = hit.shopSlug ?? 'unknown'
      const categorySlug = hit.categorySlug

      if (name && !seenLabels.has(name.toLowerCase())) {
        suggestions.push({
          type: 'product',
          label: name,
          href: `/shops/${shopSlug}/products/${slug}`,
          slug,
        })
        seenLabels.add(name.toLowerCase())
      }

      if (categorySlug && !categories.has(categorySlug)) {
        categories.set(categorySlug, categorySlug)
      }
    }

    let categoryCount = 0
    for (const [categorySlug] of categories) {
      if (categoryCount >= 2) break
      const label = categorySlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      suggestions.push({
        type: 'category',
        label,
        href: `/category/${categorySlug}`,
      })
      categoryCount++
    }

    return suggestions.slice(0, 8)
  }

  if (isMeilisearchClientConfigured() && meilisearchClient) {
    try {
      const index = meilisearchClient.index(PRODUCTS_INDEX)

      const result = await index.search(query, {
        attributesToSearchOn: ['name'],
        limit: 6,
        attributesToRetrieve: ['id', 'name', 'slug', 'categorySlug'],
      })

      const hits = result.hits.map((hit) => {
        const doc = hit as Record<string, unknown>
        return {
          name: String(doc.name ?? ''),
          slug: String(doc.slug ?? ''),
          shopSlug: doc.shopSlug ? String(doc.shopSlug) : null,
          categorySlug: doc.categorySlug ? String(doc.categorySlug) : null,
        }
      })

      return buildSuggestions(query, hits)
    } catch {
      // Fall through to DB fallback
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                            DB Fallback                                     */
  /* -------------------------------------------------------------------------- */

  try {
    const dbResults = await searchSuggestionsFallback({ data: { query } })

    const hits = dbResults.map((r) => ({
      name: r.name,
      slug: r.slug,
      shopSlug: r.shopSlug,
      categorySlug: r.categorySlug,
    }))

    return buildSuggestions(query, hits)
  } catch {
    return [{ type: 'query', label: query }]
  }
}

export function useSearchSuggestions(debouncedQuery: string, enabled: boolean) {
  return useQuery({
    queryKey: ['search-suggestions', debouncedQuery],
    queryFn: () => fetchSuggestions(debouncedQuery),
    enabled: enabled && debouncedQuery.trim().length >= 1,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: (previousData) => previousData,
  })
}
