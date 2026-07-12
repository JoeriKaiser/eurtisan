import type { QueryClient } from '@tanstack/react-query'

/** Seed the QueryClient during SSR so client useQuery does not refetch immediately. */
export function hydrateQueryData<T>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  data: T,
): T {
  queryClient.setQueryData(queryKey, data)
  return data
}
