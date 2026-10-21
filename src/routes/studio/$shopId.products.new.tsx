import { createFileRoute } from '@tanstack/react-router'
import {
  CreatorProductNewError,
  CreatorProductNewLoading,
  CreatorProductNewPage,
} from '#/components/CreatorProductNewPage'
import { listCategories } from '#/lib/categories'
import { getCreatorShops } from '#/lib/creator-dashboard'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/studio/$shopId/products/new')({
  loader: async ({ params }) => {
    const [shops, categories] = await Promise.all([
      getCreatorShops(),
      listCategories({ data: { tree: false } }),
    ])
    const current = shops.find((shop) => shop.id === params.shopId)
    const ordered = current
      ? [current, ...shops.filter((shop) => shop.id !== params.shopId)]
      : shops

    return { shops: ordered, categories }
  },
  head: () => ({
    meta: [
      { title: `${m.creator_product_new_title()} | Eurtisan` },
      { name: 'description', content: m.creator_product_new_description() },
    ],
  }),
  component: ShopProductNewRoute,
  pendingComponent: CreatorProductNewLoading,
  errorComponent: CreatorProductNewError,
})

function ShopProductNewRoute() {
  const { shops, categories } = Route.useLoaderData()
  return <CreatorProductNewPage shops={shops} categories={categories} />
}
