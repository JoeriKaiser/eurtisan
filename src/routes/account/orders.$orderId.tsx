import { createFileRoute, notFound } from '@tanstack/react-router'
import OrderDetailPage from '#/components/OrderDetailPage'
import { getBuyerOrderDetail } from '#/lib/orders'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/account/orders/$orderId')({
  beforeLoad: async () => guardAuth(),
  loader: async ({ params }) => {
    try {
      const order = await getBuyerOrderDetail({ data: { orderId: params.orderId } })
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
      { title: `${m.order_detail_title()} | Eurtisan` },
      { name: 'description', content: m.order_detail_title() },
    ],
  }),
  notFoundComponent: () => (
    <main className='page-wrap px-4 py-20 text-center'>
      <div className='mx-auto max-w-md'>
        <h1 className='display-title mb-2 text-2xl font-bold text-text-primary'>
          {m.error_not_found()}
        </h1>
        <p className='mb-8 text-text-secondary'>{m.error_not_found_description()}</p>
      </div>
    </main>
  ),
  component: OrderDetailRouteComponent,
})

function OrderDetailRouteComponent() {
  const { order } = Route.useLoaderData()
  return <OrderDetailPage order={order} />
}
