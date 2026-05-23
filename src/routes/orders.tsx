import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import z from 'zod'
import { OrdersError, OrdersLoading, OrdersPage } from '#/components/OrdersPage'
import { listBuyerOrders } from '#/lib/orders'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

const ordersSearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().catch(1),
})

const PAGE_SIZE = 10

export const Route = createFileRoute('/orders')({
  validateSearch: ordersSearchSchema,
  beforeLoad: async () => guardAuth(),
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ deps }) => {
    const page = deps.page
    const offset = (page - 1) * PAGE_SIZE
    const result = await listBuyerOrders({ data: { limit: PAGE_SIZE, offset } })
    return { ...result, page }
  },
  head: () => ({
    meta: [
      { title: `${m.orders_title()} | Eurtisan` },
      { name: 'description', content: m.orders_title() },
    ],
  }),
  component: OrdersRouteComponent,
  pendingComponent: OrdersLoading,
  errorComponent: OrdersError,
})

function OrdersRouteComponent() {
  const { orders, total, page } = Route.useLoaderData()
  const routerNavigate = Route.useNavigate()
  const [isNavigating, setIsNavigating] = useState(false)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return
    setIsNavigating(true)
    routerNavigate({ search: { page: newPage } }).finally(() => setIsNavigating(false))
  }

  return (
    <OrdersPage
      orders={orders}
      total={total}
      page={page}
      totalPages={totalPages}
      onPageChange={goToPage}
      isNavigating={isNavigating}
    />
  )
}
