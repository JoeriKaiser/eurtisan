import { Link } from '@tanstack/react-router'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { Input } from '#/components/ui/input'
import type { SearchFacets } from '#/lib/products/types'
import { m } from '#/paraglide/messages'

export function SearchFilters({
  filters,
  setFilters,
  categories,
  facets,
  navigateWithParams,
  hasActiveFilters,
  showCategory = true,
}: {
  filters: {
    query: string
    category: string
    shop: string
    minPrice: string
    maxPrice: string
    inStock: string
    sort: string
  }
  setFilters: React.Dispatch<React.SetStateAction<typeof filters>>
  categories: Array<{ id: string; name: string; slug: string }>
  /** Absent when the PostgreSQL fallback served the search; counts are hidden. */
  facets?: SearchFacets
  navigateWithParams: (overrides: Record<string, string | number | undefined>) => void
  hasActiveFilters: boolean
  showCategory?: boolean
}) {
  const categoryCounts = facets?.categorySlug
  const inStockCount = facets?.inStock.true

  const categoryLabel = (name: string, slug: string): string => {
    const count = categoryCounts?.[slug]
    return count === undefined ? name : `${name} (${count})`
  }

  return (
    <aside>
      <details className='group rounded-xl border border-border-default bg-surface-default'>
        <summary className='flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-inset focus-visible:outline-none [&::-webkit-details-marker]:hidden'>
          <span className='flex items-center gap-2'>
            <SlidersHorizontal size={16} aria-hidden='true' />
            {m.search_filters_title()}
            {hasActiveFilters ? (
              <span className='font-normal text-accent-primary'>{m.search_filters_active()}</span>
            ) : null}
          </span>
          <ChevronDown
            size={16}
            className='transition-transform duration-fast ease-out group-open:rotate-180'
            aria-hidden='true'
          />
        </summary>

        <div className='border-t border-border-default p-4 sm:p-5'>
          <div
            className={
              showCategory ? 'grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]' : 'grid gap-4'
            }
          >
            {showCategory ? (
              <div>
                <label
                  htmlFor='search-category'
                  className='mb-1.5 block text-xs font-medium text-text-secondary'
                >
                  {m.search_filter_category()}
                </label>
                <select
                  id='search-category'
                  value={filters.category}
                  onChange={(event) => {
                    setFilters((previous) => ({ ...previous, category: event.target.value }))
                    navigateWithParams({
                      category: event.target.value || undefined,
                      page: 1,
                    })
                  }}
                  className='h-10 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
                >
                  <option value=''>{m.search_filter_category_all()}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {categoryLabel(category.name, category.slug)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <span className='mb-1.5 block text-xs font-medium text-text-secondary'>
                {m.search_filter_price_eur()}
              </span>
              <div className='flex items-center gap-2'>
                <Input
                  type='number'
                  min={0}
                  step='0.01'
                  placeholder={m.search_filter_min_price()}
                  value={filters.minPrice}
                  onChange={(event) => {
                    setFilters((previous) => ({ ...previous, minPrice: event.target.value }))
                  }}
                  onBlur={() => {
                    navigateWithParams({
                      minPrice: filters.minPrice || undefined,
                      page: 1,
                    })
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      navigateWithParams({
                        minPrice: filters.minPrice || undefined,
                        page: 1,
                      })
                    }
                  }}
                  className='h-10 text-sm'
                  aria-label={m.search_filter_min_price()}
                />
                <span className='text-text-muted' aria-hidden='true'>
                  -
                </span>
                <Input
                  type='number'
                  min={0}
                  step='0.01'
                  placeholder={m.search_filter_max_price()}
                  value={filters.maxPrice}
                  onChange={(event) => {
                    setFilters((previous) => ({ ...previous, maxPrice: event.target.value }))
                  }}
                  onBlur={() => {
                    navigateWithParams({
                      maxPrice: filters.maxPrice || undefined,
                      page: 1,
                    })
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      navigateWithParams({
                        maxPrice: filters.maxPrice || undefined,
                        page: 1,
                      })
                    }
                  }}
                  className='h-10 text-sm'
                  aria-label={m.search_filter_max_price()}
                />
              </div>
            </div>
          </div>

          <label className='mt-4 flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm text-text-primary'>
            <input
              type='checkbox'
              checked={filters.inStock === 'true'}
              onChange={(event) => {
                const next = event.target.checked ? 'true' : ''
                setFilters((previous) => ({ ...previous, inStock: next }))
                navigateWithParams({ inStock: next || undefined, page: 1 })
              }}
              className='size-4 rounded border-border-default text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
            />
            <span>
              {m.search_filter_in_stock_only()}
              {inStockCount === undefined ? null : (
                <span className='text-text-muted'> ({inStockCount})</span>
              )}
            </span>
          </label>

          {hasActiveFilters ? (
            <Link
              to='/search'
              search={{}}
              className='mt-4 inline-flex min-h-11 items-center gap-1.5 py-2 text-sm font-semibold text-text-secondary no-underline transition-colors hover:text-text-primary'
            >
              <X size={15} aria-hidden='true' />
              {m.search_clear_filters()}
            </Link>
          ) : null}
        </div>
      </details>
    </aside>
  )
}
