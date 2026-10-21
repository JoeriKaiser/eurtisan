import { createFileRoute, Outlet } from '@tanstack/react-router'
import { guardShopOwnership } from '#/lib/route-guards'

export const Route = createFileRoute('/studio/$shopId/products')({
  beforeLoad: async ({ params }) => guardShopOwnership(params.shopId),
  component: ShopProductsLayout,
})

function ShopProductsLayout() {
  return <Outlet />
}
