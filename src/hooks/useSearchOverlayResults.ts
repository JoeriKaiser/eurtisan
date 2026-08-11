import { useQuery } from '@tanstack/react-query'

import { searchOverlay } from '#/lib/products'
import type { OverlayResults } from '#/lib/products.server'

export type { OverlayCategory, OverlayProduct, OverlayResults } from '#/lib/products.server'

const EMPTY: OverlayResults = { products: [], total: 0, categories: [] }

/**
 * Debounced overlay suggestions behind the app's server boundary.
 *
 * Searches run through the `searchOverlay` server function: IP rate-limited,
 * Meilisearch-key-free in the browser, with the PostgreSQL fallback handled
 * server-side. The rate limiter rejects excess keystroke traffic with an
 * error, which the overlay surfaces as an empty state.
 */
export function useSearchOverlayResults(debouncedQuery: string, enabled: boolean) {
  return useQuery({
    queryKey: ['search-overlay', debouncedQuery],
    queryFn: async () => {
      try {
        return await searchOverlay({ data: { query: debouncedQuery } })
      } catch {
        return EMPTY
      }
    },
    enabled: enabled && debouncedQuery.trim().length >= 1,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: (previousData) => previousData,
  })
}
