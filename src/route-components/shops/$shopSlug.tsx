import ShopPage from '#/components/ShopPage'
import { useLoaderData } from '@tanstack/react-router'

export function ShopRouteComponent() {
  const { shop, products, searchQuery } = useLoaderData({ from: '/shops/$shopSlug/' })
  return <ShopPage shop={shop} products={products} searchQuery={searchQuery} />
}
