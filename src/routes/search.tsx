import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { listCategories } from '#/lib/categories'
import { hydrateQueryData } from '#/lib/hydrate-query'
import { searchProducts } from '#/lib/products'
import { queryKeys } from '#/lib/query-keys'
import { createPageMeta } from '#/lib/seo'
import { m } from '#/paraglide/messages'
import { SearchPage } from '#/route-components/search'
import { SearchError } from '#/route-components/search.error'
import { SearchPending } from '#/route-components/search.pending'

const VALID_SORT_OPTIONS = ['relevance', 'price_asc', 'price_desc', 'newest'] as const
type ValidSortOption = (typeof VALID_SORT_OPTIONS)[number]

/**
 * URL contract for `/search`.
 *
 * Every optional param catches rather than throws so hand-edited, truncated,
 * or out-of-bounds query strings degrade cleanly to defaults instead of
 * triggering `SearchError` during `searchProducts` Zod validation.
 */
const searchRouteSchema = z.object({
  q: z.string().optional().catch(undefined),
  page: z.union([z.string(), z.number()]).optional().catch(undefined),
  category: z.string().optional().catch(undefined),
  shop: z.string().optional().catch(undefined),
  minPrice: z.union([z.string(), z.number()]).optional().catch(undefined),
  maxPrice: z.union([z.string(), z.number()]).optional().catch(undefined),
  inStock: z.union([z.string(), z.boolean()]).optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
})

function parseNonNegativeInt(raw: string | number | undefined): number | undefined {
  if (raw === undefined || raw === '') return undefined
  const parsed = typeof raw === 'number' ? Math.trunc(raw) : Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) return undefined
  return parsed
}

function parsePositivePage(raw: string | number | undefined): number {
  const parsed = parseNonNegativeInt(raw)
  return parsed && parsed >= 1 ? parsed : 1
}

function parseNonEmptyTrimmed(raw: string | undefined, maxLength?: number): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  return maxLength ? trimmed.slice(0, maxLength) : trimmed
}

function parseSortOption(raw: string | undefined): ValidSortOption {
  if (raw && (VALID_SORT_OPTIONS as readonly string[]).includes(raw)) {
    return raw as ValidSortOption
  }
  return 'relevance'
}

export const Route = createFileRoute('/search')({
  validateSearch: searchRouteSchema,
  loaderDeps: ({ search: { q, page, category, shop, minPrice, maxPrice, inStock, sort } }) => ({
    query: parseNonEmptyTrimmed(q, 255),
    page: parsePositivePage(page),
    categorySlug: parseNonEmptyTrimmed(category),
    shopSlug: parseNonEmptyTrimmed(shop),
    minPriceCents: parseNonNegativeInt(minPrice),
    maxPriceCents: parseNonNegativeInt(maxPrice),
    inStockOnly: inStock === true || inStock === 'true' || inStock === '1',
    sort: parseSortOption(sort),
  }),
  loader: async ({ context, deps }) => {
    const { query, page, categorySlug, shopSlug, minPriceCents, maxPriceCents, inStockOnly, sort } =
      deps

    const [categories, products] = await Promise.all([
      listCategories({ data: {} }),
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
          sort,
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
