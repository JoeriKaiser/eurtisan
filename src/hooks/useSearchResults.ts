import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { searchProducts } from '#/lib/products'

function useDebounceValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

export function useSearchResults(query: string, enabled: boolean) {
  const debouncedQuery = useDebounceValue(query, 150)

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
