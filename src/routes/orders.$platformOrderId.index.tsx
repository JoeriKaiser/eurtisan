import { createFileRoute, notFound } from '@tanstack/react-router'
import { BuyerOrderDetailLoading } from '#/components/BuyerOrderDetailLoading'
import { BuyerOrderDetailError } from '#/components/BuyerOrderDetailError'
import { OrderDetailRouteComponent } from '#/route-components/orders.$platformOrderId'
import { getBuyerOrderDetail } from '#/lib/orders'
import { getReviewableItems } from '#/lib/reviews'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/orders/$platformOrderId/')({
  beforeLoad: async () => guardAuth(),
  loader: async ({ params }) => {
    try {
      const [order, reviewable] = await Promise.all([
        getBuyerOrderDetail({ data: { orderId: params.platformOrderId } }),
        getReviewableItems({ data: { platformOrderId: params.platformOrderId } }),
      ])
      return { order, reviewableItems: reviewable.items }
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
        <h1 className='display-title mb-2 text-2xl font-semibold text-text-primary'>
          {m.error_not_found()}
        </h1>
        <p className='mb-8 text-text-secondary'>{m.error_not_found_description()}</p>
      </div>
    </main>
  ),
  component: OrderDetailRouteComponent,
  pendingComponent: BuyerOrderDetailLoading,
  errorComponent: BuyerOrderDetailError,
})
