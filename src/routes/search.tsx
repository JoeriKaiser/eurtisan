import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import ProductGrid from '#/components/ProductGrid'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { listCategories } from '#/lib/categories'
import { listShops, searchProducts } from '#/lib/products'
import { createPageMeta } from '#/lib/seo'
import { m } from '#/paraglide/messages'

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
  loader: async ({ deps }) => {
    const { query, page, categorySlug, shopSlug, minPriceCents, maxPriceCents, sort } = deps

    const [categories, shops, products] = await Promise.all([
      listCategories({ data: {} }),
      listShops(),
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

function SearchPage() {
  const {
    query,
    products,
    page,
    categories,
    shops,
    categorySlug,
    shopSlug,
    minPriceCents,
    maxPriceCents,
    sort,
  } = Route.useLoaderData()
  const router = useRouter()

  const [localQuery, setLocalQuery] = useState(query)
  const [localCategory, setLocalCategory] = useState(categorySlug ?? '')
  const [localShop, setLocalShop] = useState(shopSlug ?? '')
  const [localMinPrice, setLocalMinPrice] = useState(
    minPriceCents !== undefined ? String(minPriceCents / 100) : '',
  )
  const [localMaxPrice, setLocalMaxPrice] = useState(
    maxPriceCents !== undefined ? String(maxPriceCents / 100) : '',
  )
  const [localSort, setLocalSort] = useState(sort)

  // Sync local state when loader data changes (e.g. back/forward navigation)
  useEffect(() => {
    setLocalQuery(query)
    setLocalCategory(categorySlug ?? '')
    setLocalShop(shopSlug ?? '')
    setLocalMinPrice(minPriceCents !== undefined ? String(minPriceCents / 100) : '')
    setLocalMaxPrice(maxPriceCents !== undefined ? String(maxPriceCents / 100) : '')
    setLocalSort(sort)
  }, [query, categorySlug, shopSlug, minPriceCents, maxPriceCents, sort])

  const buildSearchParams = useCallback(
    (overrides: Record<string, string | number | undefined>) => {
      const params: Record<string, string | number> = {}

      const q = overrides.q !== undefined ? overrides.q : localQuery.trim()
      if (q) params.q = q

      const category = overrides.category !== undefined ? overrides.category : localCategory
      if (category) params.category = category

      const shop = overrides.shop !== undefined ? overrides.shop : localShop
      if (shop) params.shop = shop

      const minPrice = overrides.minPrice !== undefined ? String(overrides.minPrice) : localMinPrice
      if (minPrice) {
        const cents = Math.round(Number.parseFloat(minPrice) * 100)
        if (!Number.isNaN(cents) && cents >= 0) params.minPrice = cents
      }

      const maxPrice = overrides.maxPrice !== undefined ? String(overrides.maxPrice) : localMaxPrice
      if (maxPrice) {
        const cents = Math.round(Number.parseFloat(maxPrice) * 100)
        if (!Number.isNaN(cents) && cents >= 0) params.maxPrice = cents
      }

      const sortValue = overrides.sort !== undefined ? overrides.sort : localSort
      if (sortValue && sortValue !== 'relevance') params.sort = sortValue

      const pageValue = overrides.page !== undefined ? overrides.page : 1
      if (pageValue && pageValue !== 1) params.page = pageValue

      return params
    },
    [localQuery, localCategory, localShop, localMinPrice, localMaxPrice, localSort],
  )

  const navigateWithParams = useCallback(
    (overrides: Record<string, string | number | undefined>) => {
      router.navigate({
        to: '/search',
        search: buildSearchParams(overrides),
        replace: true,
      })
    },
    [router, buildSearchParams],
  )

  const handleSearch = useCallback(() => {
    navigateWithParams({ page: 1 })
  }, [navigateWithParams])

  const handlePageChange = useCallback(
    (newPage: number) => {
      navigateWithParams({ page: newPage })
    },
    [navigateWithParams],
  )

  const handleClearFilters = useCallback(() => {
    setLocalCategory('')
    setLocalShop('')
    setLocalMinPrice('')
    setLocalMaxPrice('')
    setLocalSort('relevance')
    router.navigate({
      to: '/search',
      search: localQuery.trim() ? { q: localQuery.trim() } : {},
      replace: true,
    })
  }, [router, localQuery])

  const hasActiveFilters =
    localCategory || localShop || localMinPrice || localMaxPrice || localSort !== 'relevance'

  const isEmptyQuery = query.length === 0
  const hasNoResults = products.products.length === 0

  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      {/* Hero search section */}
      <section className='island-shell rounded-2xl px-6 py-10 sm:px-10 sm:py-14'>
        <p className='island-kicker mb-3'>{m.search_kicker()}</p>
        <h1 className='display-title mb-6 text-4xl font-bold tracking-tight text-text-primary sm:text-5xl'>
          {m.search_title()}
        </h1>

        <div className='flex gap-2'>
          <div className='relative flex-1 sm:max-w-md'>
            <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted' />
            <Input
              type='search'
              placeholder={m.search_input_placeholder()}
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSearch()
                }
              }}
              className='pl-9'
              aria-label={m.search_input_placeholder()}
            />
          </div>
          <Button onClick={handleSearch} variant='secondary'>
            {m.search_button()}
          </Button>
        </div>
      </section>

      {/* Main content with sidebar */}
      <div className='mt-8 grid gap-6 lg:grid-cols-[280px_1fr]'>
        {/* Filter sidebar */}
        <aside className='space-y-6'>
          <div className='island-shell rounded-2xl p-5 sm:p-6'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='flex items-center gap-2 text-sm font-semibold text-text-primary'>
                <SlidersHorizontal size={16} aria-hidden='true' />
                {m.search_filters_title()}
              </h2>
              {hasActiveFilters && (
                <button
                  type='button'
                  onClick={handleClearFilters}
                  className='inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary'
                >
                  <X size={14} aria-hidden='true' />
                  {m.search_clear_filters()}
                </button>
              )}
            </div>

            <div className='space-y-4'>
              {/* Category filter */}
              <div>
                <label
                  htmlFor='search-category'
                  className='mb-1.5 block text-xs font-medium text-text-secondary'
                >
                  {m.search_filter_category()}
                </label>
                <select
                  id='search-category'
                  value={localCategory}
                  onChange={(e) => {
                    setLocalCategory(e.target.value)
                    navigateWithParams({ category: e.target.value || undefined, page: 1 })
                  }}
                  className='h-10 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
                >
                  <option value=''>{m.search_filter_category_all()}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shop filter */}
              <div>
                <label
                  htmlFor='search-shop'
                  className='mb-1.5 block text-xs font-medium text-text-secondary'
                >
                  {m.search_filter_shop()}
                </label>
                <select
                  id='search-shop'
                  value={localShop}
                  onChange={(e) => {
                    setLocalShop(e.target.value)
                    navigateWithParams({ shop: e.target.value || undefined, page: 1 })
                  }}
                  className='h-10 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
                >
                  <option value=''>{m.search_filter_shop_all()}</option>
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.slug}>
                      {shop.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price filters */}
              <div>
                <span className='mb-1.5 block text-xs font-medium text-text-secondary'>
                  {m.search_filter_price_eur()}
                </span>
                <div className='flex items-center gap-2'>
                  <div className='relative flex-1'>
                    <Input
                      type='number'
                      min={0}
                      step='0.01'
                      placeholder={m.search_filter_min_price()}
                      value={localMinPrice}
                      onChange={(e) => {
                        setLocalMinPrice(e.target.value)
                      }}
                      onBlur={() => {
                        navigateWithParams({
                          minPrice: localMinPrice || undefined,
                          page: 1,
                        })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          navigateWithParams({
                            minPrice: localMinPrice || undefined,
                            page: 1,
                          })
                        }
                      }}
                      className='h-9 text-sm'
                      aria-label={m.search_filter_min_price()}
                    />
                  </div>
                  <span className='text-text-muted'>–</span>
                  <div className='relative flex-1'>
                    <Input
                      type='number'
                      min={0}
                      step='0.01'
                      placeholder={m.search_filter_max_price()}
                      value={localMaxPrice}
                      onChange={(e) => {
                        setLocalMaxPrice(e.target.value)
                      }}
                      onBlur={() => {
                        navigateWithParams({
                          maxPrice: localMaxPrice || undefined,
                          page: 1,
                        })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          navigateWithParams({
                            maxPrice: localMaxPrice || undefined,
                            page: 1,
                          })
                        }
                      }}
                      className='h-9 text-sm'
                      aria-label={m.search_filter_max_price()}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Results area */}
        <div>
          {/* Sort bar */}
          <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
            <p className='text-sm text-text-secondary'>
              {m.search_results_count({ count: products.total })}
            </p>
            <div className='flex items-center gap-2'>
              <label htmlFor='search-sort' className='text-sm text-text-secondary'>
                {m.search_sort_label()}
              </label>
              <select
                id='search-sort'
                value={localSort}
                onChange={(e) => {
                  setLocalSort(e.target.value)
                  navigateWithParams({ sort: e.target.value, page: 1 })
                }}
                className='h-9 rounded-lg border border-border-default bg-surface-default px-3 py-1.5 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
              >
                <option value='relevance'>{m.search_sort_relevance()}</option>
                <option value='price_asc'>{m.search_sort_price_asc()}</option>
                <option value='price_desc'>{m.search_sort_price_desc()}</option>
                <option value='newest'>{m.search_sort_newest()}</option>
              </select>
            </div>
          </div>

          {/* Empty states and results */}
          {isEmptyQuery && hasNoResults && !hasActiveFilters ? (
            <div className='island-shell rounded-2xl p-8 text-center sm:p-12'>
              <Search size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
              <h2 className='mb-2 text-xl font-semibold text-text-primary'>
                {m.search_prompt_title()}
              </h2>
              <p className='text-text-secondary'>{m.search_prompt_description()}</p>
            </div>
          ) : isEmptyQuery && !hasNoResults ? (
            <div className='space-y-6'>
              <div className='island-shell rounded-2xl px-6 py-8'>
                <h2 className='mb-1 text-xl font-semibold text-text-primary'>
                  {m.search_all_products_title()}
                </h2>
                <p className='text-text-secondary'>{m.search_all_products_description()}</p>
              </div>
              <ProductGrid
                products={products.products}
                page={page}
                totalPages={products.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          ) : hasNoResults ? (
            <div className='island-shell rounded-2xl p-8 text-center sm:p-12'>
              <h2 className='mb-2 text-xl font-semibold text-text-primary'>
                {m.search_no_results_title()}
              </h2>
              <p className='mb-6 text-text-secondary'>
                {m.search_no_results_description({ query })}
              </p>
              <Link
                to='/category/all'
                className='inline-flex items-center gap-2 rounded-lg bg-accent-primary px-6 py-3 text-sm font-medium text-text-on-primary no-underline transition-colors hover:bg-accent-primary-hover'
              >
                {m.search_no_results_browse_categories()}
              </Link>
            </div>
          ) : (
            <ProductGrid
              products={products.products}
              page={page}
              totalPages={products.totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>
    </main>
  )
}

function SearchError({ error }: { error: Error }) {
  return (
    <main className='page-wrap px-4 py-20 text-center'>
      <h1 className='display-title mb-4 text-3xl font-bold text-text-primary'>
        {m.error_unexpected()}
      </h1>
      <p className='mb-6 text-text-secondary'>{error.message}</p>
    </main>
  )
}

function SearchPending() {
  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <section className='island-shell rounded-2xl px-6 py-10 sm:px-10 sm:py-14'>
        <div className='mb-4 h-4 w-20 animate-pulse rounded bg-[var(--sand)]' />
        <div className='mb-6 h-10 w-2/3 animate-pulse rounded bg-[var(--sand)]' />
        <div className='flex gap-2'>
          <div className='h-10 flex-1 animate-pulse rounded bg-[var(--sand)] sm:max-w-md' />
          <div className='h-10 w-20 animate-pulse rounded bg-[var(--sand)]' />
        </div>
      </section>
      <div className='mt-8 grid gap-6 lg:grid-cols-[280px_1fr]'>
        <div className='island-shell rounded-2xl p-5 sm:p-6'>
          <div className='mb-4 h-5 w-24 animate-pulse rounded bg-[var(--sand)]' />
          <div className='space-y-4'>
            <div className='h-10 w-full animate-pulse rounded bg-[var(--sand)]' />
            <div className='h-10 w-full animate-pulse rounded bg-[var(--sand)]' />
            <div className='flex gap-2'>
              <div className='h-9 flex-1 animate-pulse rounded bg-[var(--sand)]' />
              <div className='h-9 flex-1 animate-pulse rounded bg-[var(--sand)]' />
            </div>
          </div>
        </div>
        <div>
          <div className='mb-4 flex items-center justify-between'>
            <div className='h-4 w-24 animate-pulse rounded bg-[var(--sand)]' />
            <div className='h-9 w-40 animate-pulse rounded bg-[var(--sand)]' />
          </div>
          <div
            className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
            role='status'
            aria-live='polite'
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={`skeleton-${n}`}
                className='island-shell flex flex-col overflow-hidden rounded-2xl'
              >
                <div className='aspect-[4/3] w-full animate-pulse bg-[var(--sand)]' />
                <div className='flex flex-1 flex-col gap-2 p-4'>
                  <div className='h-5 w-2/3 animate-pulse rounded bg-[var(--sand)]' />
                  <div className='h-4 w-full animate-pulse rounded bg-[var(--sand)]' />
                  <div className='mt-auto h-6 w-1/3 animate-pulse rounded bg-[var(--sand)]' />
                </div>
              </div>
            ))}
            <span className='sr-only'>{m.product_grid_loading()}</span>
          </div>
        </div>
      </div>
    </main>
  )
}
