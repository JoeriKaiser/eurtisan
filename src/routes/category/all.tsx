import { createFileRoute } from '@tanstack/react-router'
import { CategoriesAllPage } from '#/route-components/category/all'
import { CategoriesAllError } from '#/route-components/category/all.error'
import { CategoriesAllPending } from '#/route-components/category/all.pending'
import { listCategoriesWithCounts } from '#/lib/categories'
import { m } from '#/paraglide/messages'
import { createPageMeta } from '#/lib/seo'

export const Route = createFileRoute('/category/all')({
  loader: async () => {
    const categories = await listCategoriesWithCounts()
    return { categories }
  },
  head: () =>
    createPageMeta({
      title: m.categories_all_meta_title(),
      description: m.categories_all_meta_description(),
      canonicalPath: '/category/all',
    }),
  component: CategoriesAllPage,
  errorComponent: CategoriesAllError,
  pendingComponent: CategoriesAllPending,
})
