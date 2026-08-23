import BuyerOrderDetailPage from '#/route-components/account/orders/BuyerOrderDetailPage'
import { useLoaderData } from '@tanstack/react-router'

export function OrderDetailRouteComponent() {
  const { order, reviewableItems, returns } = useLoaderData({
    from: '/orders/$platformOrderId/',
  })
  return <BuyerOrderDetailPage order={order} reviewableItems={reviewableItems} returns={returns} />
}
