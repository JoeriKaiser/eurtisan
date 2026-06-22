import BuyerOrderDetailPage from '#/components/BuyerOrderDetailPage'
import { useLoaderData } from '@tanstack/react-router'

export function OrderDetailRouteComponent() {
  const { order } = useLoaderData({ from: '/account/orders/$orderId' })
  return <BuyerOrderDetailPage order={order} />
}
