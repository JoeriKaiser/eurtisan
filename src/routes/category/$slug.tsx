import { createFileRoute, notFound } from '@tanstack/react-router'
import { CategoryPage } from '#/route-components/category/$slug'
import { getCategoryBySlug } from '#/lib/categories'
import { listProductsByCategorySlug } from '#/lib/products'

export const Route = createFileRoute('/category/$slug')({
  loader: async ({ params }) => {
    const [category, products] = await Promise.all([
      getCategoryBySlug({ data: { slug: params.slug } }),
      listProductsByCategorySlug({ data: { slug: params.slug } }),
    ])

    if (!category) {
      throw notFound()
    }

    return { category, products }
  },
  component: CategoryPage,
})
