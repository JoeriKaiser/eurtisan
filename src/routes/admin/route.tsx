import { createFileRoute } from '@tanstack/react-router'
import { AdminLayout } from '#/components/admin/AdminLayout'
import { getPendingShopReviewCount } from '#/lib/admin-dashboard'
import { guardPrivilegedRole } from '#/lib/route-guards'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => guardPrivilegedRole('admin'),
  loader: async () => ({ pendingShopReviewCount: await getPendingShopReviewCount() }),
  component: AdminLayout,
})
