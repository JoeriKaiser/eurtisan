import { SlidersHorizontal, X } from 'lucide-react'
import { Input } from '#/components/ui/input'
import { m } from '#/paraglide/messages'

export function SearchFilters({
  filters,
  setFilters,
  categories,
  shops,
  navigateWithParams,
  handleClearFilters,
  hasActiveFilters,
}: {
  filters: {
    query: string
    category: string
    shop: string
    minPrice: string
    maxPrice: string
    sort: string
  }
  setFilters: React.Dispatch<React.SetStateAction<typeof filters>>
  categories: Array<{ id: string; name: string; slug: string }>
  shops: Array<{ id: string; name: string; slug: string }>
  navigateWithParams: (overrides: Record<string, string | number | undefined>) => void
  handleClearFilters: () => void
  hasActiveFilters: boolean
}) {
  return (
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
              value={filters.category}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, category: e.target.value }))
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
              value={filters.shop}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, shop: e.target.value }))
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
                  value={filters.minPrice}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, minPrice: e.target.value }))
                  }}
                  onBlur={() => {
                    navigateWithParams({
                      minPrice: filters.minPrice || undefined,
                      page: 1,
                    })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      navigateWithParams({
                        minPrice: filters.minPrice || undefined,
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
                  value={filters.maxPrice}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, maxPrice: e.target.value }))
                  }}
                  onBlur={() => {
                    navigateWithParams({
                      maxPrice: filters.maxPrice || undefined,
                      page: 1,
                    })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      navigateWithParams({
                        maxPrice: filters.maxPrice || undefined,
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
  )
}
