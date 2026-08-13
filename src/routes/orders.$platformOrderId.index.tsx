import { createFileRoute, notFound } from '@tanstack/react-router'
import { NotFoundPage } from '#/components/NotFoundPage'
import { BuyerOrderDetailLoading } from '#/components/BuyerOrderDetailLoading'
import { BuyerOrderDetailError } from '#/components/BuyerOrderDetailError'
import { OrderDetailRouteComponent } from '#/route-components/orders.$platformOrderId'
import { getBuyerOrderDetail } from '#/lib/orders'
import { getReviewableItems } from '#/lib/reviews'
import { listOrderReturns } from '#/lib/returns'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/orders/$platformOrderId/')({
  loader: async ({ params }) => {
    try {
      const [order, reviewableResult, returns] = await Promise.all([
        getBuyerOrderDetail({ data: { orderId: params.platformOrderId } }),
        getReviewableItems({ data: { platformOrderId: params.platformOrderId } }).catch(() => ({
          items: [],
        })),
        listOrderReturns({ data: { platformOrderId: params.platformOrderId } }),
      ])
      return { order, reviewableItems: reviewableResult.items, returns }
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
  notFoundComponent: NotFoundPage,
  component: OrderDetailRouteComponent,
  pendingComponent: BuyerOrderDetailLoading,
  errorComponent: BuyerOrderDetailError,
})
