import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import {
  getCreatorDashboardStats,
  getCreatorRecentActivity,
  getCreatorShops,
} from '#/lib/creator-dashboard'
import { guardRole } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

const route = getRouteApi('/creator')

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
  lazy: async () => {
    const { CreatorDashboardPage, CreatorDashboardLoading, CreatorDashboardError } = await import(
      '#/components/CreatorDashboardPage'
    )

    function CreatorWrapper() {
      const { stats, activity, shops } = route.useLoaderData()
      return <CreatorDashboardPage stats={stats} activity={activity} shops={shops} />
    }

    return {
      component: CreatorWrapper,
      pendingComponent: CreatorDashboardLoading,
      errorComponent: CreatorDashboardError,
    }
  },
})
