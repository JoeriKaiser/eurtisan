import { createFileRoute, notFound } from '@tanstack/react-router'
import { ShopOrderDetailPage } from '#/route-components/studio/$shopId.orders.$shopOrderId'
import { ShopOrderDetailPending } from '#/route-components/studio/$shopId.orders.$shopOrderId.pending'
import { ShopOrderDetailError } from '#/route-components/studio/$shopId.orders.$shopOrderId.error'
import { getShopOrderDetail } from '#/lib/shop-orders'
import { guardShopOwnership } from '#/lib/route-guards'

export const Route = createFileRoute('/studio/$shopId/orders/$shopOrderId')({
  beforeLoad: async ({ params }) => guardShopOwnership(params.shopId),
  loader: async ({ params }) => {
    const order = await getShopOrderDetail({ data: { shopOrderId: params.shopOrderId } }).catch(
      (err) => {
        if (err instanceof Response && err.status === 404) {
          throw notFound()
        }
        throw err
      },
    )
    if (!order || order.shopId !== params.shopId) {
      throw notFound()
    }
    return { order }
  },
  head: () => ({
    meta: [{ title: 'Order Detail | Studio' }],
  }),
  component: ShopOrderDetailPage,
  pendingComponent: ShopOrderDetailPending,
  errorComponent: ShopOrderDetailError,
})
