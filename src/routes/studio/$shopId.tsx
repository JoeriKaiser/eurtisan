import { createFileRoute } from '@tanstack/react-router'
import { ShopDashboard } from '#/route-components/studio/$shopId'
import { guardShopOwnership } from '#/lib/route-guards'

export const Route = createFileRoute('/studio/$shopId')({
  beforeLoad: async ({ params }) => guardShopOwnership(params.shopId),
  component: ShopDashboard,
})
