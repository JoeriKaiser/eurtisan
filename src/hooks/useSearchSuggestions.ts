import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  isMeilisearchClientConfigured,
  meilisearchClient,
  PRODUCTS_INDEX,
} from '#/lib/meilisearch-client'

export interface SearchSuggestion {
  type: 'query' | 'product' | 'category'
  label: string
  href?: string
  slug?: string
}

async function fetchSuggestions(query: string): Promise<SearchSuggestion[]> {
  if (!isMeilisearchClientConfigured() || !meilisearchClient || query.trim().length < 1) {
    return []
  }

  try {
    const index = meilisearchClient.index(PRODUCTS_INDEX)

    // Search product names only for fast autocomplete
    const result = await index.search(query, {
      attributesToSearchOn: ['name'],
      limit: 6,
      attributesToRetrieve: ['id', 'name', 'slug', 'categorySlug'],
    })

    const suggestions: SearchSuggestion[] = []
    const seenLabels = new Set<string>()

    // Add query suggestion itself
    suggestions.push({ type: 'query', label: query })
    seenLabels.add(query.toLowerCase())

    const categories = new Map<string, string>()

    for (const hit of result.hits) {
      const doc = hit as Record<string, unknown>
      const name = String(doc.name ?? '')
      const slug = String(doc.slug ?? '')
      const categorySlug = doc.categorySlug ? String(doc.categorySlug) : null

      if (name && !seenLabels.has(name.toLowerCase())) {
        suggestions.push({ type: 'product', label: name, href: `/products/${slug}`, slug })
        seenLabels.add(name.toLowerCase())
      }

      if (categorySlug && !categories.has(categorySlug)) {
        categories.set(categorySlug, categorySlug)
      }
    }

    // Add category shortcuts (max 2)
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
  } catch {
    // Fallback: just return the query as a suggestion
    return [{ type: 'query', label: query }]
  }
}

function useDebounceValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

export function useSearchSuggestions(query: string, enabled: boolean) {
  const debouncedQuery = useDebounceValue(query, 150)

  return useQuery({
    queryKey: ['search-suggestions', debouncedQuery],
    queryFn: () => fetchSuggestions(debouncedQuery),
    enabled: enabled && debouncedQuery.trim().length >= 1 && isMeilisearchClientConfigured(),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: (previousData) => previousData,
  })
}
