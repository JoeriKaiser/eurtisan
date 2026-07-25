import { Link, useLoaderData, useRouter } from '@tanstack/react-router'
import { ArrowLeft, ChevronLeft, ChevronRight, Search, Shuffle } from 'lucide-react'
import { useCallback, useState } from 'react'
import ProductGrid from '#/components/ProductGrid'
import { m } from '#/paraglide/messages'
import { DiscoveryWall } from './search/DiscoveryWall'
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
    categorySlug,
    shopSlug,
    minPriceCents,
    maxPriceCents,
    inStockOnly,
    sort,
  } = useLoaderData({ from: '/search' })
  const router = useRouter()

  const [filters, setFilters] = useState({
    query: query ?? '',
    category: categorySlug ?? '',
    shop: shopSlug ?? '',
    minPrice: minPriceCents !== undefined ? String(minPriceCents / 100) : '',
    maxPrice: maxPriceCents !== undefined ? String(maxPriceCents / 100) : '',
    inStock: inStockOnly ? 'true' : '',
    sort: sort ?? 'relevance',
  })

  const buildSearchParams = useCallback(
    (overrides: Record<string, string | number | undefined>) => {
      const params: Record<string, string | number> = {}

      const q = Object.hasOwn(overrides, 'q') ? overrides.q : filters.query.trim()
      if (q) params.q = q

      const category = Object.hasOwn(overrides, 'category') ? overrides.category : filters.category
      if (category) params.category = category

      const shop = Object.hasOwn(overrides, 'shop') ? overrides.shop : filters.shop
      if (shop) params.shop = shop

      const minPrice = Object.hasOwn(overrides, 'minPrice')
        ? String(overrides.minPrice ?? '')
        : filters.minPrice
      if (minPrice) {
        const cents = Math.round(Number.parseFloat(minPrice) * 100)
        if (!Number.isNaN(cents) && cents >= 0) params.minPrice = cents
      }

      const maxPrice = Object.hasOwn(overrides, 'maxPrice')
        ? String(overrides.maxPrice ?? '')
        : filters.maxPrice
      if (maxPrice) {
        const cents = Math.round(Number.parseFloat(maxPrice) * 100)
        if (!Number.isNaN(cents) && cents >= 0) params.maxPrice = cents
      }

      const inStock = Object.hasOwn(overrides, 'inStock') ? overrides.inStock : filters.inStock
      if (inStock) params.inStock = 'true'

      const sortValue = Object.hasOwn(overrides, 'sort') ? overrides.sort : filters.sort
      if (sortValue && sortValue !== 'relevance') params.sort = sortValue

      const pageValue = Object.hasOwn(overrides, 'page') ? overrides.page : 1
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

  const hasActiveFilters = Boolean(
    filters.category ||
      filters.shop ||
      filters.minPrice ||
      filters.maxPrice ||
      filters.inStock ||
      filters.sort !== 'relevance',
  )

  const isVisualBrowseMode = query.length === 0
  const hasNoResults = products.products.length === 0

  const handleSurprise = useCallback(() => {
    const candidates = products.products.filter((product) => product.shopSlug)
    const product = candidates[Math.floor(Math.random() * candidates.length)]
    if (!product?.shopSlug) return

    router.navigate({
      to: '/shops/$shopSlug/products/$productSlug',
      params: { shopSlug: product.shopSlug, productSlug: product.slug },
    })
  }, [products.products, router])

  return (
    <main className='mx-auto w-full max-w-[1320px] px-4 pb-16'>
      <section className='pb-6 pt-8 sm:pb-7 sm:pt-10'>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <h1 className='display-title max-w-[22ch] text-3xl font-semibold tracking-tight text-text-primary text-balance sm:text-4xl'>
            {isVisualBrowseMode ? m.search_explore_title() : m.search_results_title({ query })}
          </h1>
          {isVisualBrowseMode ? (
            <button
              type='button'
              onClick={handleSurprise}
              disabled={products.products.every((product) => !product.shopSlug)}
              className='inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-default bg-surface-default px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:border-border-strong hover:bg-surface-inset active:bg-bg-inset disabled:cursor-not-allowed disabled:opacity-50'
            >
              <Shuffle size={16} aria-hidden='true' />
              {m.search_surprise_me()}
            </button>
          ) : (
            <Link
              to='/search'
              search={{}}
              replace
              className='inline-flex min-h-11 items-center gap-2 py-2 text-sm font-semibold text-text-primary no-underline transition-colors hover:text-accent-primary'
            >
              <ArrowLeft size={16} aria-hidden='true' />
              {m.search_back_to_discovery()}
            </Link>
          )}
        </div>
      </section>

      <section className='border-y border-border-default py-4'>
        <nav
          className='flex items-center gap-2 overflow-x-auto pb-1'
          aria-label={m.search_filter_category()}
        >
          <Link
            to='/search'
            search={(previous) => ({ ...previous, category: undefined, page: undefined })}
            replace
            className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 py-2 text-sm font-semibold no-underline transition-colors ${
              filters.category
                ? 'bg-surface-inset text-text-secondary hover:text-text-primary'
                : 'bg-accent-primary text-text-on-primary'
            }`}
            aria-current={!filters.category ? 'page' : undefined}
          >
            {m.search_filter_category_all()}
          </Link>
          {categories.map((category) => {
            const isSelected = filters.category === category.slug
            return (
              <Link
                key={category.id}
                to='/search'
                search={(previous) => ({
                  ...previous,
                  category: category.slug,
                  page: undefined,
                })}
                replace
                className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 py-2 text-sm font-semibold no-underline transition-colors ${
                  isSelected
                    ? 'bg-accent-primary text-text-on-primary'
                    : 'bg-surface-inset text-text-secondary hover:text-text-primary'
                }`}
                aria-current={isSelected ? 'page' : undefined}
              >
                {category.name}
              </Link>
            )
          })}
        </nav>
      </section>

      <section className='pt-5'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <p className='text-sm font-medium text-text-secondary' aria-live='polite'>
            {isVisualBrowseMode
              ? m.search_objects_count({ count: products.total })
              : m.search_results_count({ count: products.total })}
          </p>
          <nav
            className='flex items-center gap-2 overflow-x-auto'
            aria-label={m.search_sort_label()}
          >
            <span className='shrink-0 text-sm text-text-secondary'>{m.search_sort_label()}</span>
            {[
              { value: 'relevance', label: m.search_sort_relevance() },
              { value: 'price_asc', label: m.search_sort_price_asc() },
              { value: 'price_desc', label: m.search_sort_price_desc() },
              { value: 'newest', label: m.search_sort_newest() },
            ].map((option) => (
              <Link
                key={option.value}
                to='/search'
                search={(previous) => ({
                  ...previous,
                  sort: option.value === 'relevance' ? undefined : option.value,
                  page: undefined,
                })}
                replace
                className={`shrink-0 rounded-lg px-3 py-2 text-sm no-underline ${
                  filters.sort === option.value
                    ? 'bg-accent-primary text-text-on-primary'
                    : 'bg-surface-inset text-text-secondary'
                }`}
                aria-current={filters.sort === option.value ? 'page' : undefined}
              >
                {option.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className='mt-4'>
          <SearchFilters
            filters={filters}
            setFilters={setFilters}
            categories={categories}
            facets={products.facets}
            navigateWithParams={navigateWithParams}
            hasActiveFilters={hasActiveFilters}
            showCategory={!isVisualBrowseMode}
          />
        </div>

        <div className='mt-5'>
          {hasNoResults ? (
            <div className='rounded-2xl border border-border-default bg-surface-inset p-8 text-center sm:p-12'>
              <Search size={36} className='mx-auto mb-4 text-accent-primary' aria-hidden='true' />
              <h2 className='mb-2 text-xl font-semibold text-text-primary'>
                {m.search_no_results_title()}
              </h2>
              <p className='mx-auto mb-6 max-w-lg text-text-secondary'>
                {query
                  ? m.search_no_results_description({ query })
                  : m.search_no_filter_results_description()}
              </p>
              <Link
                to='/search'
                search={{}}
                replace
                className='inline-flex min-h-11 items-center rounded-xl bg-accent-primary px-6 py-3 text-sm font-semibold text-text-on-primary no-underline transition-colors hover:bg-accent-primary-hover active:bg-accent-primary-active'
              >
                {m.search_clear_filters()}
              </Link>
            </div>
          ) : isVisualBrowseMode ? (
            <DiscoveryWall products={products.products} />
          ) : (
            <div className='space-y-6'>
              <ProductGrid products={products.products} />
              <SearchPagination page={page} totalPages={products.totalPages} />
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function SearchPagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null

  const paginationLinkClass =
    'inline-flex min-h-10 items-center gap-1 rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary no-underline transition-colors hover:bg-surface-inset'
  const disabledClass =
    'inline-flex min-h-10 items-center gap-1 rounded-lg border border-border-default bg-surface-inset px-3 py-2 text-sm text-text-muted opacity-50'

  return (
    <nav aria-label={m.product_pagination()} className='flex items-center justify-center gap-2'>
      {page > 1 ? (
        <Link
          to='/search'
          search={(previous) => ({
            ...previous,
            page: page - 1 === 1 ? undefined : page - 1,
          })}
          className={paginationLinkClass}
          aria-label={m.pagination_previous()}
        >
          <ChevronLeft size={16} aria-hidden='true' />
          <span className='hidden sm:inline'>{m.pagination_previous()}</span>
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled='true'>
          <ChevronLeft size={16} aria-hidden='true' />
          <span className='hidden sm:inline'>{m.pagination_previous()}</span>
        </span>
      )}

      <span className='text-sm text-text-secondary'>
        {m.pagination_page_of({ page, totalPages })}
      </span>

      {page < totalPages ? (
        <Link
          to='/search'
          search={(previous) => ({ ...previous, page: page + 1 })}
          className={paginationLinkClass}
          aria-label={m.pagination_next()}
        >
          <span className='hidden sm:inline'>{m.pagination_next()}</span>
          <ChevronRight size={16} aria-hidden='true' />
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled='true'>
          <span className='hidden sm:inline'>{m.pagination_next()}</span>
          <ChevronRight size={16} aria-hidden='true' />
        </span>
      )}
    </nav>
  )
}
