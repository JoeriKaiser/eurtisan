import { createFileRoute, Outlet } from '@tanstack/react-router'
import { guardPrivilegedRole } from '#/lib/route-guards'

export const Route = createFileRoute('/creator')({
  beforeLoad: async () => guardPrivilegedRole('creator'),
  component: () => <Outlet />,
})
