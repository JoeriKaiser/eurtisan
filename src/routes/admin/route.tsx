import { createFileRoute } from '@tanstack/react-router'
import { AdminLayout } from '#/components/admin/AdminLayout'
import { guardPrivilegedRole } from '#/lib/route-guards'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => guardPrivilegedRole('admin'),
  component: AdminLayout,
})
