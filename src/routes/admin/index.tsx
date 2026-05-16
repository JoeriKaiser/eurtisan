import { createFileRoute } from '@tanstack/react-router'
import { getAdminDashboardStats, getRecentOrders, getRecentSignups } from '#/lib/admin-dashboard'
import { guardRole } from '#/lib/route-guards'
import { AdminDashboard, AdminDashboardError, AdminDashboardPending } from './AdminDashboard'

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
  component: AdminDashboard,
  pendingComponent: AdminDashboardPending,
  errorComponent: AdminDashboardError,
})
