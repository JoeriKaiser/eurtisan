import { createFileRoute, Outlet } from '@tanstack/react-router'
import { guardRole } from '#/lib/route-guards'

export const Route = createFileRoute('/creator')({
  beforeLoad: async () => guardRole('creator'),
  component: () => <Outlet />,
})
