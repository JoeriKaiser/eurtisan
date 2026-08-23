import BuyerOrderDetailPage from '#/route-components/account/orders/BuyerOrderDetailPage'
import { useLoaderData } from '@tanstack/react-router'

export function OrderDetailRouteComponent() {
  const { order } = useLoaderData({ from: '/account/orders/$orderNumber' })
  return <BuyerOrderDetailPage order={order} backTo='/account/orders' />
}
