import { createFileRoute, notFound } from '@tanstack/react-router'
import z from 'zod'
import { CategoryPage } from '#/route-components/category/$slug'
import { getCategoryBySlug } from '#/lib/categories'
import { listProductsByCategorySlug } from '#/lib/products'

const categorySearchSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
})

export const Route = createFileRoute('/category/$slug')({
  validateSearch: categorySearchSchema,
  loaderDeps: ({ search: { page, pageSize } }) => ({
    page: Number(page) || 1,
    pageSize: Number(pageSize) || 20,
  }),
  loader: async ({ params, deps }) => {
    const [category, products] = await Promise.all([
      getCategoryBySlug({ data: { slug: params.slug } }),
      listProductsByCategorySlug({
        data: { slug: params.slug, page: deps.page, pageSize: deps.pageSize },
      }),
    ])

    if (!category) {
      throw notFound()
    }

    return { category, products, page: deps.page }
  },
  component: CategoryPage,
})
