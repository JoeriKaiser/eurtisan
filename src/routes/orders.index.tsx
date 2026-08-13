import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { OrdersError, OrdersLoading } from '#/components/OrdersPage'
import { OrdersRouteComponent } from '#/route-components/orders'
import { listBuyerOrders } from '#/lib/orders'
import { m } from '#/paraglide/messages'

const ordersSearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().catch(1),
})

const PAGE_SIZE = 10

export const Route = createFileRoute('/orders/')({
  validateSearch: ordersSearchSchema,
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
