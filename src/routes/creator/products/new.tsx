import { createFileRoute } from '@tanstack/react-router'
import {
  CreatorProductNewError,
  CreatorProductNewLoading,
} from '#/components/CreatorProductNewPage'
import { CreatorProductNewRouteComponent } from '#/route-components/creator/products/new'
import { listCategories } from '#/lib/categories'
import { getCreatorShops } from '#/lib/creator-dashboard'
import { guardPrivilegedRole } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/creator/products/new')({
  beforeLoad: async () => guardPrivilegedRole('creator'),
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
