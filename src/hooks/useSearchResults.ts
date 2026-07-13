import { useQuery } from '@tanstack/react-query'
import { searchProducts } from '#/lib/products'

export function useSearchResults(debouncedQuery: string, enabled: boolean) {
  return useQuery({
    queryKey: ['search-results', debouncedQuery],
    queryFn: async () => {
      const result = await searchProducts({
        data: {
          query: debouncedQuery.trim(),
          page: 1,
          pageSize: 12,
          sort: 'relevance',
        },
      })
      return result
    },
    enabled: enabled && debouncedQuery.trim().length >= 1,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: (previousData) => previousData,
  })
}
