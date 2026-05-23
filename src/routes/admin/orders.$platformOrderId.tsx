import { createFileRoute, notFound } from '@tanstack/react-router'
import {
  AdminOrderDetailPage,
  AdminOrderDetailPending,
  AdminOrderDetailError,
} from '#/route-components/admin/orders.$platformOrderId'
import { getPlatformOrderDetail } from '#/lib/admin-orders'

export const Route = createFileRoute('/admin/orders/$platformOrderId')({
  loader: async ({ params }) => {
    try {
      return await getPlatformOrderDetail({
        data: { orderId: params.platformOrderId },
      })
    } catch (err) {
      if (err instanceof Response && err.status === 404) {
        throw notFound()
      }
      throw err
    }
  },
  head: () => ({
    meta: [{ title: 'Order Inspection | Admin | Eurtisan' }],
  }),
  component: AdminOrderDetailPage,
  pendingComponent: AdminOrderDetailPending,
  errorComponent: AdminOrderDetailError,
})
