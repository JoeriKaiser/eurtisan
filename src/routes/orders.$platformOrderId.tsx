import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireOrderAccess } from '#/lib/orders'

export const Route = createFileRoute('/orders/$platformOrderId')({
  beforeLoad: async ({ params }) =>
    requireOrderAccess({ data: { orderId: params.platformOrderId } }),
  component: () => <Outlet />,
})
