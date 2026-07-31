import { createFileRoute, notFound } from '@tanstack/react-router'
import z from 'zod'
import { NotFoundPage } from '#/components/NotFoundPage'
import { CategoryPage } from '#/route-components/category/$slug'
import { getCategoryBySlug } from '#/lib/categories'
import { listProductsByCategorySlug } from '#/lib/products'

/**
 * URL contract for a category page.
 *
 * Every optional param catches rather than throws: a hand-edited or truncated
 * URL should degrade to the default view, not to an error page. `inStock`
 * accepts the raw value and is normalised in `loaderDeps` — `z.coerce.boolean()`
 * would read `?inStock=false` as true.
 */
const categorySearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().catch(undefined),
  pageSize: z.coerce.number().int().min(1).max(100).optional().catch(undefined),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).optional().catch(undefined),
  inStock: z.union([z.string(), z.boolean()]).optional().catch(undefined),
  minPrice: z.coerce.number().min(0).optional().catch(undefined),
  maxPrice: z.coerce.number().min(0).optional().catch(undefined),
})

/** Euros in the URL, cents in the query — the boundary is here. */
function toCents(euros: number | undefined): number | undefined {
  return euros === undefined ? undefined : Math.round(euros * 100)
}

export const Route = createFileRoute('/category/$slug')({
  validateSearch: categorySearchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page ?? 1,
    pageSize: search.pageSize ?? 20,
    sort: search.sort ?? 'newest',
    inStockOnly: search.inStock === true || search.inStock === 'true',
    minPriceCents: toCents(search.minPrice),
    maxPriceCents: toCents(search.maxPrice),
  }),
  loader: async ({ params, deps }) => {
    const [category, products] = await Promise.all([
      getCategoryBySlug({ data: { slug: params.slug } }),
      listProductsByCategorySlug({
        data: {
          slug: params.slug,
          page: deps.page,
          pageSize: deps.pageSize,
          sort: deps.sort,
          inStockOnly: deps.inStockOnly,
          minPriceCents: deps.minPriceCents,
          maxPriceCents: deps.maxPriceCents,
        },
      }),
    ])

    if (!category) {
      throw notFound()
    }

    return {
      category,
      products,
      page: deps.page,
      sort: deps.sort,
      inStockOnly: deps.inStockOnly,
      minPrice: deps.minPriceCents === undefined ? '' : String(deps.minPriceCents / 100),
      maxPrice: deps.maxPriceCents === undefined ? '' : String(deps.maxPriceCents / 100),
    }
  },
  notFoundComponent: NotFoundPage,
  component: CategoryPage,
})
