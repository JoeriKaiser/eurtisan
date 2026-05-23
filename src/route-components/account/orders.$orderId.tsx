import OrderDetailPage from '#/components/OrderDetailPage'
import { useLoaderData } from '@tanstack/react-router'

export function OrderDetailRouteComponent() {
  const { order } = useLoaderData({ from: '/account/orders/$orderId' })
  return <OrderDetailPage order={order} />
}
