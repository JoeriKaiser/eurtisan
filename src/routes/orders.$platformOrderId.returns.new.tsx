import { createFileRoute, notFound } from '@tanstack/react-router'
import z from 'zod'
import { ReturnRequestPage } from '#/components/ReturnRequestPage'
import { getBuyerOrderDetail, requireOrderAccess } from '#/lib/orders'

export const Route = createFileRoute('/orders/$platformOrderId/returns/new')({
  validateSearch: z.object({ shopOrderId: z.string().uuid() }),
  beforeLoad: async ({ params }) =>
    requireOrderAccess({ data: { orderId: params.platformOrderId } }),
  loaderDeps: ({ search }) => ({ shopOrderId: search.shopOrderId }),
  loader: async ({ params, deps }) => {
    const order = await getBuyerOrderDetail({ data: { orderId: params.platformOrderId } })
    if (!order?.shops.some((shop) => shop.shopOrderId === deps.shopOrderId)) {
      throw notFound()
    }
    return { order, shopOrderId: deps.shopOrderId }
  },
  component: ReturnRequestRoute,
})

function ReturnRequestRoute() {
  const { order, shopOrderId } = Route.useLoaderData()
  return <ReturnRequestPage order={order} shopOrderId={shopOrderId} />
}
