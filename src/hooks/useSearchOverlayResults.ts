import { useQuery } from '@tanstack/react-query'

import { searchOverlay } from '#/lib/products/search-overlay.functions'

export type { OverlayCategory, OverlayProduct, OverlayResults } from '#/lib/products.server'

/**
 * Debounced overlay suggestions behind the app's server boundary.
 *
 * Searches run through the `searchOverlay` server function: IP rate-limited,
 * Meilisearch-key-free in the browser, with the PostgreSQL fallback handled
 * server-side. Errors propagate so the overlay shows an error state rather than
 * falsely claiming no products match.
 */
export function useSearchOverlayResults(debouncedQuery: string, enabled: boolean) {
  const normalizedQuery = debouncedQuery.trim()

  return useQuery({
    queryKey: ['search-overlay', normalizedQuery],
    queryFn: () => searchOverlay({ data: { query: normalizedQuery } }),
    enabled: enabled && normalizedQuery.length >= 1,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: false,
    placeholderData: (previousData) => previousData,
  })
}
