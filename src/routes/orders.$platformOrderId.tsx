import { createFileRoute, Outlet } from '@tanstack/react-router'
import { guardAuth } from '#/lib/route-guards'

export const Route = createFileRoute('/orders/$platformOrderId')({
  beforeLoad: async () => guardAuth(),
  component: () => <Outlet />,
})
