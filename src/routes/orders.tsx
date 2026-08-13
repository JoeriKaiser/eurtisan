import { createFileRoute, Outlet } from '@tanstack/react-router'
import { guardAuth } from '#/lib/route-guards'

export const Route = createFileRoute('/orders')({
  beforeLoad: async () => guardAuth(),
  component: OrdersLayout,
})

function OrdersLayout() {
  return <Outlet />
}
