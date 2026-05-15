import { useQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { useRef } from 'react'
import OrderSuccessPage from '#/components/OrderSuccessPage'
import { getBuyerOrderDetail } from '#/lib/orders'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/orders/$platformOrderId/success')({
  beforeLoad: async () => guardAuth(),
  loader: async ({ params }) => {
    try {
      const order = await getBuyerOrderDetail({ data: { orderId: params.platformOrderId } })
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
        <h1 className='display-title mb-2 text-2xl font-bold text-text-primary'>
          {m.error_not_found()}
        </h1>
        <p className='mb-8 text-text-secondary'>{m.error_not_found_description()}</p>
      </div>
    </main>
  ),
  component: OrderSuccessRouteComponent,
})

const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS = 5 * 60 * 1_000 // 5 minutes

function OrderSuccessRouteComponent() {
  const { order: initialOrder } = Route.useLoaderData()
  const { platformOrderId } = Route.useParams()
  const pollStartTime = useRef(Date.now())

  const { data: order = initialOrder } = useQuery({
    queryKey: ['order-success-poll', platformOrderId],
    queryFn: () => getBuyerOrderDetail({ data: { orderId: platformOrderId } }),
    refetchInterval: (query) => {
      const status = query.state.data?.status ?? initialOrder.status
      const elapsed = Date.now() - pollStartTime.current
      if (status !== 'pending_payment' || elapsed > POLL_TIMEOUT_MS) {
        return false
      }
      return POLL_INTERVAL_MS
    },
    initialData: initialOrder,
  })

  return <OrderSuccessPage order={order} />
}
