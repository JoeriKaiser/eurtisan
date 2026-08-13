import { CreatorShopSettingsPage } from '#/components/CreatorShopSettingsPage'
import { useLoaderData } from '@tanstack/react-router'

export function CreatorShopRouteComponent() {
  const { shop, allShops } = useLoaderData({ from: '/creator/shop' })
  return <CreatorShopSettingsPage shop={shop} allShops={allShops} />
}
