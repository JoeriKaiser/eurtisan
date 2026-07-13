import { useLoaderData, Link, useRouter } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useCallback, useState } from 'react'
import ProductGrid from '#/components/ProductGrid'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { m } from '#/paraglide/messages'
import { SearchFilters } from './search/SearchFilters'

export function SearchPage() {
  const data = useLoaderData({ from: '/search' })
  const stateKey = [
    data.query,
    data.page,
    data.categorySlug,
    data.shopSlug,
    data.minPriceCents,
    data.maxPriceCents,
    data.sort,
  ].join(':')
  return <SearchPageContent key={stateKey} />
}

function SearchPageContent() {
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
  } = useLoaderData({ from: '/search' })
  const router = useRouter()

  const [filters, setFilters] = useState({
    query: query ?? '',
    category: categorySlug ?? '',
    shop: shopSlug ?? '',
    minPrice: minPriceCents !== undefined ? String(minPriceCents / 100) : '',
    maxPrice: maxPriceCents !== undefined ? String(maxPriceCents / 100) : '',
    sort: sort ?? 'relevance',
  })

  const buildSearchParams = useCallback(
    (overrides: Record<string, string | number | undefined>) => {
      const params: Record<string, string | number> = {}

      const q = overrides.q !== undefined ? overrides.q : filters.query.trim()
      if (q) params.q = q

      const category = overrides.category !== undefined ? overrides.category : filters.category
      if (category) params.category = category

      const shop = overrides.shop !== undefined ? overrides.shop : filters.shop
      if (shop) params.shop = shop

      const minPrice =
        overrides.minPrice !== undefined ? String(overrides.minPrice) : filters.minPrice
      if (minPrice) {
        const cents = Math.round(Number.parseFloat(minPrice) * 100)
        if (!Number.isNaN(cents) && cents >= 0) params.minPrice = cents
      }

      const maxPrice =
        overrides.maxPrice !== undefined ? String(overrides.maxPrice) : filters.maxPrice
      if (maxPrice) {
        const cents = Math.round(Number.parseFloat(maxPrice) * 100)
        if (!Number.isNaN(cents) && cents >= 0) params.maxPrice = cents
      }

      const sortValue = overrides.sort !== undefined ? overrides.sort : filters.sort
      if (sortValue && sortValue !== 'relevance') params.sort = sortValue

      const pageValue = overrides.page !== undefined ? overrides.page : 1
      if (pageValue && pageValue !== 1) params.page = pageValue

      return params
    },
    [filters],
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
    setFilters((prev) => ({
      ...prev,
      query: '',
      category: '',
      shop: '',
      minPrice: '',
      maxPrice: '',
      sort: 'relevance',
    }))
    router.navigate({
      to: '/search',
      search: {},
      replace: true,
    })
  }, [router])

  const hasActiveFilters = Boolean(
    filters.category ||
      filters.shop ||
      filters.minPrice ||
      filters.maxPrice ||
      filters.sort !== 'relevance',
  )

  const isEmptyQuery = query.length === 0
  const hasNoResults = products.products.length === 0
  const showSearchPrompt = isEmptyQuery && hasNoResults && products.total === 0 && !hasActiveFilters

  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      {/* Hero search section */}
      <section className='island-shell rounded-2xl px-6 py-10 sm:px-10 sm:py-14'>
        <p className='island-kicker mb-3'>{m.search_kicker()}</p>
        <h1 className='display-title mb-6 text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl'>
          {m.search_title()}
        </h1>

        <div className='flex gap-2'>
          <div className='relative flex-1 sm:max-w-md'>
            <Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted' />
            <Input
              type='search'
              placeholder={m.search_input_placeholder()}
              value={filters.query}
              onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
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
        <SearchFilters
          filters={filters}
          setFilters={setFilters}
          categories={categories}
          shops={shops}
          navigateWithParams={navigateWithParams}
          handleClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Results area */}
        <div>
          {/* Sort bar */}
          <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
            {!showSearchPrompt && (
              <p className='text-sm text-text-secondary'>
                {m.search_results_count({ count: products.total })}
              </p>
            )}
            <div className='flex items-center gap-2'>
              <label htmlFor='search-sort' className='text-sm text-text-secondary'>
                {m.search_sort_label()}
              </label>
              <select
                id='search-sort'
                value={filters.sort}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, sort: e.target.value }))
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
          {showSearchPrompt ? (
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
