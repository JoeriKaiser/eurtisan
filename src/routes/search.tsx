import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { listCategoriesWithCounts } from '#/lib/categories'
import { hydrateQueryData } from '#/lib/hydrate-query'
import { searchProducts } from '#/lib/products'
import { queryKeys } from '#/lib/query-keys'
import { createPageMeta } from '#/lib/seo'
import { m } from '#/paraglide/messages'
import { SearchPage } from '#/route-components/search'
import { SearchError } from '#/route-components/search.error'
import { SearchPending } from '#/route-components/search.pending'

const searchRouteSchema = z.object({
  q: z.string().optional(),
  page: z.union([z.string(), z.number()]).optional(),
  category: z.string().optional(),
  shop: z.string().optional(),
  minPrice: z.union([z.string(), z.number()]).optional(),
  maxPrice: z.union([z.string(), z.number()]).optional(),
  inStock: z.union([z.string(), z.boolean()]).optional(),
  sort: z.string().optional(),
})

export const Route = createFileRoute('/search')({
  validateSearch: searchRouteSchema,
  loaderDeps: ({ search: { q, page, category, shop, minPrice, maxPrice, inStock, sort } }) => ({
    query: typeof q === 'string' ? q.trim() : undefined,
    page:
      typeof page === 'number'
        ? page
        : typeof page === 'string'
          ? Number.parseInt(page, 10) || 1
          : 1,
    categorySlug: typeof category === 'string' ? category.trim() : undefined,
    shopSlug: typeof shop === 'string' ? shop.trim() : undefined,
    minPriceCents: (() => {
      const value = typeof minPrice === 'number' ? String(minPrice) : minPrice
      if (typeof value !== 'string' || value === '') return undefined
      const parsed = Number.parseInt(value, 10)
      return Number.isNaN(parsed) ? undefined : parsed
    })(),
    maxPriceCents: (() => {
      const value = typeof maxPrice === 'number' ? String(maxPrice) : maxPrice
      if (typeof value !== 'string' || value === '') return undefined
      const parsed = Number.parseInt(value, 10)
      return Number.isNaN(parsed) ? undefined : parsed
    })(),
    inStockOnly: inStock === true || inStock === 'true' || inStock === '1',
    sort: typeof sort === 'string' ? sort : 'relevance',
  }),
  loader: async ({ context, deps }) => {
    const { query, page, categorySlug, shopSlug, minPriceCents, maxPriceCents, inStockOnly, sort } =
      deps

    const [categories, products] = await Promise.all([
      listCategoriesWithCounts(),
      searchProducts({
        data: {
          query,
          page,
          pageSize: 24,
          categorySlug,
          shopSlug,
          minPriceCents,
          maxPriceCents,
          inStockOnly,
          sort: sort as 'relevance' | 'price_asc' | 'price_desc' | 'newest',
        },
      }),
    ])

    hydrateQueryData(context.queryClient, queryKeys.categoriesList, categories)

    return {
      query: query ?? '',
      products,
      page,
      categories,
      categorySlug,
      shopSlug,
      minPriceCents,
      maxPriceCents,
      inStockOnly,
      sort,
    }
  },
  head: ({ loaderData }) => {
    const query = loaderData?.query ?? ''
    const title = query ? m.search_meta_title({ query }) : m.search_discovery_meta_title()
    const description = query
      ? m.search_meta_description({ query })
      : m.search_discovery_meta_description()
    const canonicalPath = query ? `/search?q=${encodeURIComponent(query)}` : '/search'

    const { meta, links } = createPageMeta({
      title,
      description,
      canonicalPath,
    })

    return { meta, links }
  },
  component: SearchPage,
  errorComponent: SearchError,
  pendingComponent: SearchPending,
})
