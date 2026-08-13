import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { listShopCustomers } from '#/lib/customers'
import { ShopCustomersPage } from '#/route-components/studio/$shopId.customers'
import { ShopCustomersPending } from '#/route-components/studio/$shopId.customers.pending'
import { ShopCustomersError } from '#/route-components/studio/$shopId.customers.error'

const customersSearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  search: z.string().optional(),
})

export const Route = createFileRoute('/studio/$shopId/customers/')({
  validateSearch: customersSearchSchema,
  loaderDeps: ({ search: { page, search } }) => ({ page, searchQuery: search }),
  loader: async ({ params, deps }) => {
    const result = await listShopCustomers({
      data: {
        shopId: params.shopId,
        page: deps.page,
        pageSize: 20,
        search: deps.searchQuery,
      },
    })
    return { result, searchQuery: deps.searchQuery }
  },
  head: () => ({
    meta: [{ title: 'Customers | Studio' }],
  }),
  component: ShopCustomersPage,
  pendingComponent: ShopCustomersPending,
  errorComponent: ShopCustomersError,
})
