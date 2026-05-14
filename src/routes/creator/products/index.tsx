import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { z } from 'zod'
import { getCreatorShops } from '#/lib/creator-dashboard'
import { listCreatorProducts } from '#/lib/creator-products'
import { m } from '#/paraglide/messages'

const route = getRouteApi('/creator/products/')

const productSearchSchema = z.object({
  shopId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  active: z.enum(['true', 'false', 'all']).optional().default('all'),
  search: z.string().max(200).optional(),
})

export const Route = createFileRoute('/creator/products/')({
  validateSearch: productSearchSchema,
  loader: async ({ search }) => {
    const shops = await getCreatorShops()
    const targetShop = shops.find((s) => s.id === search.shopId) ?? shops[0] ?? null

    let products: Awaited<ReturnType<typeof listCreatorProducts>> = {
      products: [],
      total: 0,
      page: search.page,
      pageSize: search.pageSize,
      totalPages: 0,
    }

    if (targetShop) {
      products = await listCreatorProducts({
        data: {
          shopId: targetShop.id,
          page: search.page,
          pageSize: search.pageSize,
          active: search.active,
          search: search.search,
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
  lazy: async () => {
    const {
      CreatorProductsPage,
      CreatorProductsLoading,
      CreatorProductsError,
    } = await import('#/components/CreatorProductsPage')

    function CreatorProductsWrapper() {
      const { shops, products, currentShopId } = route.useLoaderData()
      const search = route.useSearch()
      return (
        <CreatorProductsPage
          shops={shops}
          products={products}
          currentShopId={currentShopId}
          initialSearch={search}
        />
      )
    }

    return {
      component: CreatorProductsWrapper,
      pendingComponent: CreatorProductsLoading,
      errorComponent: CreatorProductsError,
    }
  },
})
