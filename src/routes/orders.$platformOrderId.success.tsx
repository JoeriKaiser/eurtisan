import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { NotFoundPage } from '#/components/NotFoundPage'
import { getBuyerOrderDetail, type OrderDetail } from '#/lib/orders'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'
import { OrderSuccessRouteComponent } from '#/route-components/orders.$platformOrderId.success'

export const Route = createFileRoute('/orders/$platformOrderId/success')({
  beforeLoad: async () => guardAuth(),
  loader: async ({ params }) => {
    let order: OrderDetail
    try {
      order = await getBuyerOrderDetail({ data: { orderId: params.platformOrderId } })
    } catch (err) {
      if (err instanceof Response && err.status === 404) {
        throw notFound()
      }
      throw err
    }

    // If the order is cancelled, redirect to the standard order details page.
    if (order.status === 'cancelled') {
      throw redirect({
        to: '/orders/$platformOrderId',
        params: { platformOrderId: params.platformOrderId },
      })
    }

    // If the order is still pending payment and was created more than 5 minutes ago,
    // redirect to the standard order details page.
    if (order.status === 'pending_payment') {
      const orderAgeMs = Date.now() - new Date(order.createdAt).getTime()
      const fiveMinutesMs = 5 * 60 * 1000
      if (orderAgeMs > fiveMinutesMs) {
        throw redirect({
          to: '/orders/$platformOrderId',
          params: { platformOrderId: params.platformOrderId },
        })
      }
    }

    return { order }
  },
  head: () => ({
    meta: [
      { title: `${m.order_success_title()} | Eurtisan` },
      { name: 'description', content: m.order_success_title() },
    ],
  }),
  notFoundComponent: NotFoundPage,
  component: OrderSuccessRouteComponent,
})
