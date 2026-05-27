import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { OrderSuccessRouteComponent } from '#/route-components/orders.$platformOrderId.success'
import { getBuyerOrderDetail } from '#/lib/orders'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/orders/$platformOrderId/success')({
  beforeLoad: async () => guardAuth(),
  loader: async ({ params }) => {
    try {
      const order = await getBuyerOrderDetail({ data: { orderId: params.platformOrderId } })

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
    } catch (err) {
      if (err instanceof Response && err.status === 404) {
        throw notFound()
      }
      throw err
    }
  },
  head: () => ({
    meta: [
      { title: `${m.order_success_title()} | Eurtisan` },
      { name: 'description', content: m.order_success_title() },
    ],
  }),
  notFoundComponent: () => (
    <main className='page-wrap px-4 py-20 text-center'>
      <div className='mx-auto max-w-md'>
        <h1 className='display-title mb-2 text-2xl font-semibold text-text-primary'>
          {m.error_not_found()}
        </h1>
        <p className='mb-8 text-text-secondary'>{m.error_not_found_description()}</p>
      </div>
    </main>
  ),
  component: OrderSuccessRouteComponent,
})
