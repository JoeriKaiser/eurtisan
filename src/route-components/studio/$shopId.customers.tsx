import { useLoaderData, useParams, useSearch } from '@tanstack/react-router'
import { ShopCustomersPage as ShopCustomersPageComponent } from '#/components/studio/ShopCustomersPage'

export function ShopCustomersPage() {
  const { shopId } = useParams({ from: '/studio/$shopId/customers/' })
  const { result, searchQuery } = useLoaderData({ from: '/studio/$shopId/customers/' })
  const search = useSearch({ from: '/studio/$shopId/customers/' })

  return (
    <ShopCustomersPageComponent
      shopId={shopId}
      result={result}
      searchQuery={searchQuery ?? ''}
      page={search.page ?? 1}
    />
  )
}
