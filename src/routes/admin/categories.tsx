import { createFileRoute } from '@tanstack/react-router'
import { listCategories } from '#/lib/categories'
import { listCategoriesAdmin } from '#/lib/admin-categories'
import { AdminCategoriesPage } from '#/route-components/admin/categories'
import { AdminCategoriesPending } from '#/route-components/admin/categories.pending'
import { AdminCategoriesError } from '#/route-components/admin/categories.error'

export const Route = createFileRoute('/admin/categories')({
  loader: async () => {
    const [flat, tree] = await Promise.all([
      listCategoriesAdmin({ data: undefined }),
      listCategories({ data: { tree: true } }),
    ])
    return { flat, tree }
  },
  head: () => ({ meta: [{ title: 'Categories | Admin | Eurtisan' }] }),
  component: AdminCategoriesPage,
  pendingComponent: AdminCategoriesPending,
  errorComponent: AdminCategoriesError,
})
