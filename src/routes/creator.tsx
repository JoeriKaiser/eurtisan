import { createFileRoute } from '@tanstack/react-router'
import {
  CreatorDashboardError,
  CreatorDashboardLoading,
  CreatorDashboardPage,
} from '#/components/CreatorDashboardPage'
import {
  getCreatorDashboardStats,
  getCreatorRecentActivity,
  getCreatorShops,
} from '#/lib/creator-dashboard'
import { guardRole } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/creator')({
  beforeLoad: async () => guardRole('creator'),
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

function CreatorRouteComponent() {
  const { stats, activity, shops } = Route.useLoaderData()
  return <CreatorDashboardPage stats={stats} activity={activity} shops={shops} />
}
