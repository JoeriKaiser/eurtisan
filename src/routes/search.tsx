import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { listCategories } from '#/lib/categories'
import { listShops, searchProducts } from '#/lib/products'
import { createPageMeta } from '#/lib/seo'
import { m } from '#/paraglide/messages'
import { SearchPage } from '#/route-components/search'
import { SearchPending } from '#/route-components/search.pending'
import { SearchError } from '#/route-components/search.error'
import { hydrateQueryData } from '#/lib/hydrate-query'
import { queryKeys } from '#/lib/query-keys'

const searchRouteSchema = z.object({
  q: z.string().optional(),
  page: z.string().optional(),
  category: z.string().optional(),
  shop: z.string().optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  sort: z.string().optional(),
})

export const Route = createFileRoute('/search')({
  validateSearch: searchRouteSchema,
  loaderDeps: ({ search: { q, page, category, shop, minPrice, maxPrice, sort } }) => ({
    query: typeof q === 'string' ? q.trim() : undefined,
    page: typeof page === 'string' ? Number.parseInt(page, 10) || 1 : 1,
    categorySlug: typeof category === 'string' ? category.trim() : undefined,
    shopSlug: typeof shop === 'string' ? shop.trim() : undefined,
    minPriceCents:
      typeof minPrice === 'string'
        ? Number.isNaN(Number.parseInt(minPrice, 10))
          ? undefined
          : Number.parseInt(minPrice, 10)
        : undefined,
    maxPriceCents:
      typeof maxPrice === 'string'
        ? Number.isNaN(Number.parseInt(maxPrice, 10))
          ? undefined
          : Number.parseInt(maxPrice, 10)
        : undefined,
    sort: typeof sort === 'string' ? sort : 'relevance',
  }),
  loader: async ({ context, deps }) => {
    const { query, page, categorySlug, shopSlug, minPriceCents, maxPriceCents, sort } = deps

    const [categories, shops, products] = await Promise.all([
      listCategories({ data: {} }),
      listShops({ data: { page: 1, pageSize: 100 } }),
      searchProducts({
        data: {
          query,
          page,
          pageSize: 24,
          categorySlug,
          shopSlug,
          minPriceCents,
          maxPriceCents,
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
      shops,
      categorySlug,
      shopSlug,
      minPriceCents,
      maxPriceCents,
      sort,
    }
  },
  head: ({ loaderData }) => {
    const query = loaderData?.query ?? ''
    const title = query ? m.search_meta_title({ query }) : m.meta_title_default()
    const description = query ? m.search_meta_description({ query }) : m.home_description()
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
