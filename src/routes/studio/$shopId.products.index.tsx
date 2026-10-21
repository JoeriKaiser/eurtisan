import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import {
  CreatorProductsError,
  CreatorProductsLoading,
  CreatorProductsPage,
} from '#/components/CreatorProductsPage'
import { getCreatorShops } from '#/lib/creator-dashboard'
import { listCreatorProducts } from '#/lib/creator-products'
import { m } from '#/paraglide/messages'

const productSearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  active: z.enum(['true', 'false', 'all']).optional().default('all'),
  status: z.enum(['all', 'draft', 'published', 'archived']).optional().default('all'),
  search: z.string().max(200).optional(),
})

export const Route = createFileRoute('/studio/$shopId/products/')({
  validateSearch: productSearchSchema,
  loaderDeps: ({ search: { page, pageSize, active, status, search } }) => ({
    page,
    pageSize,
    active,
    status,
    search,
  }),
  loader: async ({ params, deps }) => {
    const shops = await getCreatorShops()
    const products = await listCreatorProducts({
      data: {
        shopId: params.shopId,
        page: deps.page,
        pageSize: deps.pageSize,
        active: deps.active,
        status: deps.status,
        search: deps.search,
      },
    })

    return { shops, products, currentShopId: params.shopId }
  },
  head: () => ({
    meta: [
      { title: `${m.creator_products_title()} | Eurtisan` },
      { name: 'description', content: m.creator_products_description() },
    ],
  }),
  component: ShopProductsRoute,
  pendingComponent: CreatorProductsLoading,
  errorComponent: CreatorProductsError,
})

function ShopProductsRoute() {
  const { shops, products, currentShopId } = Route.useLoaderData()
  const search = Route.useSearch()
  return (
    <CreatorProductsPage
      shops={shops}
      products={products}
      currentShopId={currentShopId}
      initialSearch={{ ...search, shopId: currentShopId }}
    />
  )
}
