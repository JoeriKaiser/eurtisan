import { createFileRoute, Outlet } from '@tanstack/react-router'
import { guardShopOwnership } from '#/lib/route-guards'

export const Route = createFileRoute('/studio/$shopId/customers')({
  beforeLoad: async ({ params }) => guardShopOwnership(params.shopId),
  component: () => <Outlet />,
})
