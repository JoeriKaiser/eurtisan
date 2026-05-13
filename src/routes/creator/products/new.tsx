import { createFileRoute } from '@tanstack/react-router'
import {
  CreatorProductNewError,
  CreatorProductNewLoading,
  CreatorProductNewPage,
} from '#/components/CreatorProductNewPage'
import { listCategories } from '#/lib/categories'
import { getCreatorShops } from '#/lib/creator-dashboard'
import { guardRole } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/creator/products/new')({
  beforeLoad: async () => guardRole('creator'),
  loader: async () => {
    const [shops, categories] = await Promise.all([
      getCreatorShops(),
      listCategories({ data: { tree: false } }),
    ])

    return { shops, categories }
  },
  head: () => ({
    meta: [
      { title: `${m.creator_product_new_title()} | Eurtisan` },
      { name: 'description', content: m.creator_product_new_description() },
    ],
  }),
  component: CreatorProductNewRouteComponent,
  pendingComponent: CreatorProductNewLoading,
  errorComponent: CreatorProductNewError,
})

function CreatorProductNewRouteComponent() {
  const { shops, categories } = Route.useLoaderData()
  return <CreatorProductNewPage shops={shops} categories={categories} />
}
