import { useQuery } from '@tanstack/react-query'
import { useLoaderData, useParams } from '@tanstack/react-router'
import { useCallback, useRef } from 'react'
import OrderSuccessPage from '#/components/OrderSuccessPage'
import { retryPayment } from '#/lib/checkout'
import { getBuyerOrderDetail } from '#/lib/orders'

const POLL_INTERVAL_MS = 3_000
const POLL_TIMEOUT_MS = 5 * 60 * 1_000 // 5 minutes

export function OrderSuccessRouteComponent() {
  const { order: initialOrder } = useLoaderData({ from: '/orders/$platformOrderId/success' })
  const { platformOrderId } = useParams({ from: '/orders/$platformOrderId/success' })
  const pollStartTime = useRef<number | null>(null)
  if (pollStartTime.current === null) {
    pollStartTime.current = Date.now()
  }

  const { data: order = initialOrder } = useQuery({
    queryKey: ['order-success-poll', platformOrderId],
    queryFn: () => getBuyerOrderDetail({ data: { orderId: platformOrderId } }),
    refetchInterval: (query) => {
      const status = query.state.data?.status ?? initialOrder.status
      const elapsed = Date.now() - (pollStartTime.current ?? Date.now())
      if (status !== 'pending_payment' || elapsed > POLL_TIMEOUT_MS) {
        return false
      }
      return POLL_INTERVAL_MS
    },
    initialData: initialOrder,
  })

  const handleRetryPayment = useCallback(async () => {
    return retryPayment({ data: { platformOrderId } })
  }, [platformOrderId])

  return <OrderSuccessPage order={order} onRetryPayment={handleRetryPayment} />
}
