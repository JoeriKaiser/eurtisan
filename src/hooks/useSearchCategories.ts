import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { listCategories } from '#/lib/categories'
import { queryKeys } from '#/lib/query-keys'

export function useSearchCategories(query: string, enabled: boolean) {
  const { data: allCategories = [], isLoading } = useQuery({
    queryKey: queryKeys.categoriesList,
    queryFn: () => listCategories({ data: {} }),
    enabled,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  })

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return allCategories.slice(0, 8)

    return allCategories
      .filter(
        (cat) =>
          cat.name.toLowerCase().includes(trimmed) || cat.slug.toLowerCase().includes(trimmed),
      )
      .slice(0, 8)
  }, [allCategories, query])

  return { categories: filtered, isLoading, allCategories }
}
