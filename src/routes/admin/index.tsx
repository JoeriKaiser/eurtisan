import { createFileRoute } from '@tanstack/react-router'
import {
  getAdminDashboardStats,
  getDashboardTrends,
  getRecentAuditEntries,
  getRecentOrders,
  getRecentSignups,
} from '#/lib/admin-dashboard'
import {
  AdminDashboard,
  AdminDashboardError,
  AdminDashboardPending,
} from '#/route-components/admin/index'

export const Route = createFileRoute('/admin/')({
  loader: async () => {
    const [stats, signups, orders, trends, auditEntries] = await Promise.all([
      getAdminDashboardStats(),
      getRecentSignups(),
      getRecentOrders(),
      getDashboardTrends(),
      getRecentAuditEntries(),
    ])
    return { stats, signups, orders, trends, auditEntries }
  },
  component: AdminDashboard,
  pendingComponent: AdminDashboardPending,
  errorComponent: AdminDashboardError,
})
