import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import {
  CreatorProductsError,
  CreatorProductsLoading,
  CreatorProductsPage,
} from '#/components/CreatorProductsPage'
import { getCreatorShops } from '#/lib/creator-dashboard'
import { listCreatorProducts } from '#/lib/creator-products'
import { guardPrivilegedRole } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

const productSearchSchema = z.object({
  shopId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  active: z.enum(['true', 'false', 'all']).optional().default('all'),
  search: z.string().max(200).optional(),
})

export const Route = createFileRoute('/creator/products/')({
  validateSearch: productSearchSchema,
  loaderDeps: ({ search: { shopId, page, pageSize, active, search } }) => ({
    shopId,
    page,
    pageSize,
    active,
    search,
  }),
  beforeLoad: async () => guardPrivilegedRole('creator'),
  loader: async ({ deps }) => {
    const shops = await getCreatorShops()
    const targetShop = shops.find((s) => s.id === deps.shopId) ?? shops[0] ?? null

    let products: Awaited<ReturnType<typeof listCreatorProducts>> = {
      products: [],
      total: 0,
      page: deps.page,
      pageSize: deps.pageSize,
      totalPages: 0,
    }

    if (targetShop) {
      products = await listCreatorProducts({
        data: {
          shopId: targetShop.id,
          page: deps.page,
          pageSize: deps.pageSize,
          active: deps.active,
          search: deps.search,
        },
      })
    }

    return { shops, products, currentShopId: targetShop?.id ?? null }
  },
  head: () => ({
    meta: [
      { title: `${m.creator_products_title()} | Eurtisan` },
      { name: 'description', content: m.creator_products_description() },
    ],
  }),
  component: CreatorProductsRouteComponent,
  pendingComponent: CreatorProductsLoading,
  errorComponent: CreatorProductsError,
})

function CreatorProductsRouteComponent() {
  const { shops, products, currentShopId } = Route.useLoaderData()
  const search = Route.useSearch()
  return (
    <CreatorProductsPage
      shops={shops}
      products={products}
      currentShopId={currentShopId}
      initialSearch={search}
    />
  )
}
