import { createFileRoute } from '@tanstack/react-router'
import { ShopDashboard } from '#/route-components/studio/$shopId'
import { guardShopOwnership } from '#/lib/route-guards'
import { getShopDashboardStatsQuery } from '#/lib/creator-dashboard.server'

export const Route = createFileRoute('/studio/$shopId')({
  beforeLoad: async ({ params }) => guardShopOwnership(params.shopId),
  loader: async ({ params }) => {
    const stats = await getShopDashboardStatsQuery(params.shopId)
    return { stats }
  },
  component: ShopDashboard,
})
