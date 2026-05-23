import { CreatorDashboardPage } from '#/components/CreatorDashboardPage'
import { useLoaderData } from '@tanstack/react-router'

export function CreatorRouteComponent() {
  const { stats, activity, shops } = useLoaderData({ from: '/creator' })
  return <CreatorDashboardPage stats={stats} activity={activity} shops={shops} />
}
