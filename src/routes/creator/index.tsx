import { createFileRoute } from '@tanstack/react-router'
import { CreatorDashboardError, CreatorDashboardLoading } from '#/components/CreatorDashboardPage'
import { CreatorRouteComponent } from '#/route-components/creator'
import {
  getCreatorDashboardStats,
  getCreatorRecentActivity,
  getCreatorShops,
} from '#/lib/creator-dashboard'
import { guardPrivilegedRole } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/creator/')({
  beforeLoad: async () => guardPrivilegedRole('creator'),
  loader: async () => {
    const [stats, activity, shops] = await Promise.all([
      getCreatorDashboardStats(),
      getCreatorRecentActivity({ data: { limit: 20 } }),
      getCreatorShops(),
    ])
    return { stats, activity, shops }
  },
  head: () => ({
    meta: [
      { title: `${m.creator_title()} | Eurtisan` },
      { name: 'description', content: m.creator_description() },
    ],
  }),
  component: CreatorRouteComponent,
  pendingComponent: CreatorDashboardLoading,
  errorComponent: CreatorDashboardError,
})
