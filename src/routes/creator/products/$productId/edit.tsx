import { createFileRoute } from '@tanstack/react-router'
import {
  CreatorProductEditError,
  CreatorProductEditLoading,
  CreatorProductEditPage,
} from '#/components/CreatorProductEditPage'
import { listCategories } from '#/lib/categories'
import { getCreatorShops } from '#/lib/creator-dashboard'
import { getCreatorProductDetail } from '#/lib/creator-products'
import { guardRole } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/creator/products/$productId/edit')({
  beforeLoad: async () => guardRole('creator'),
  loader: async ({ params }) => {
    const [shops, categories, product] = await Promise.all([
      getCreatorShops(),
      listCategories({ data: { tree: false } }),
      getCreatorProductDetail({ data: { productId: params.productId } }),
    ])

    return { shops, categories, product }
  },
  head: () => ({
    meta: [
      { title: `${m.creator_product_edit_title()} | Eurtisan` },
      { name: 'description', content: m.creator_product_edit_description() },
    ],
  }),
  component: CreatorProductEditRouteComponent,
  pendingComponent: CreatorProductEditLoading,
  errorComponent: CreatorProductEditError,
})

function CreatorProductEditRouteComponent() {
  const { shops, categories, product } = Route.useLoaderData()
  return <CreatorProductEditPage shops={shops} categories={categories} product={product} />
}
