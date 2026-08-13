import { CreatorPayoutsPage } from '#/components/CreatorPayoutsPage'
import { useLoaderData, useSearch } from '@tanstack/react-router'

export function CreatorPayoutsRouteComponent() {
  const { shops, payouts, currentShopId } = useLoaderData({ from: '/creator/payouts' })
  const search = useSearch({ from: '/creator/payouts' })
  return (
    <CreatorPayoutsPage
      shops={shops}
      payouts={payouts}
      currentShopId={currentShopId}
      initialStatus={search.status}
    />
  )
}
