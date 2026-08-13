import { createFileRoute, Outlet } from '@tanstack/react-router'
import { guardAuth } from '#/lib/route-guards'

export const Route = createFileRoute('/account/orders')({
  beforeLoad: async () => guardAuth(),
  component: AccountOrdersLayout,
})

function AccountOrdersLayout() {
  return <Outlet />
}
