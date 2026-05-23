import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import {
  ShopOrdersPage,
  ShopOrdersPending,
  ShopOrdersError,
} from '#/route-components/studio/$shopId.orders'
import { guardShopOwnership } from '#/lib/route-guards'
import { listShopOrders } from '#/lib/shop-orders'

const ordersSearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  status: z.string().optional(),
  search: z.string().optional(),
})

export const Route = createFileRoute('/studio/$shopId/orders')({
  validateSearch: ordersSearchSchema,
  loaderDeps: ({ search: { page, status, search } }) => ({
    page,
    status,
    searchQuery: search,
  }),
  beforeLoad: async ({ params }) => guardShopOwnership(params.shopId),
  loader: async ({ params, deps }) => {
    const result = await listShopOrders({
      data: {
        shopId: params.shopId,
        status: deps.status,
        search: deps.searchQuery,
        page: deps.page,
        pageSize: 20,
      },
    })
    return { result, status: deps.status, searchQuery: deps.searchQuery }
  },
  head: () => ({
    meta: [{ title: 'Orders | Studio' }],
  }),
  component: ShopOrdersPage,
  pendingComponent: ShopOrdersPending,
  errorComponent: ShopOrdersError,
})
