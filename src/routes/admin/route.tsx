import { createFileRoute } from '@tanstack/react-router'
import { AdminLayout } from '#/components/admin/AdminLayout'
import { guardRole } from '#/lib/route-guards'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => guardRole('admin'),
  component: AdminLayout,
})
