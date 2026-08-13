import { createFileRoute, Outlet } from '@tanstack/react-router'
import { guardShopOwnership } from '#/lib/route-guards'

export const Route = createFileRoute('/studio/$shopId')({
  beforeLoad: async ({ params }) => guardShopOwnership(params.shopId),
  component: StudioShopLayout,
})

function StudioShopLayout() {
  return <Outlet />
}
