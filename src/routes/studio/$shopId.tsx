import { createFileRoute } from '@tanstack/react-router'
import { ShopDashboard } from '#/route-components/studio/$shopId'
import { guardShopOwnership } from '#/lib/route-guards'
import { getShopDashboardStats } from '#/lib/creator-dashboard'

export const Route = createFileRoute('/studio/$shopId')({
  beforeLoad: async ({ params }) => guardShopOwnership(params.shopId),
  loader: async ({ params }) => {
    const stats = await getShopDashboardStats({ data: { shopId: params.shopId } })
    return { stats }
  },
  component: ShopDashboard,
})
