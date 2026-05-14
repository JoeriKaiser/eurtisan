import { createFileRoute } from '@tanstack/react-router'
import { getAdminDashboardStats, getRecentOrders, getRecentSignups } from '#/lib/admin-dashboard'
import { guardRole } from '#/lib/route-guards'

export const Route = createFileRoute('/admin/')({
  beforeLoad: async () => guardRole('admin'),
  loader: async () => {
    const [stats, signups, orders] = await Promise.all([
      getAdminDashboardStats(),
      getRecentSignups(),
      getRecentOrders(),
    ])
    return { stats, signups, orders }
  },
  lazy: async () => {
    const mod = await import('./AdminDashboard')
    return {
      component: mod.AdminDashboard,
      pendingComponent: mod.AdminDashboardPending,
      errorComponent: mod.AdminDashboardError,
    }
  },
})
