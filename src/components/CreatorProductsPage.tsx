import { useRouter } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Package, Search } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { toggleProductActive } from '#/lib/creator-products'
import { m } from '#/paraglide/messages'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { CreatorProductsLoading } from './CreatorProductsLoading'
import { CreatorProductsError } from './CreatorProductsError'
import { ProductTableRow, type CreatorProduct } from './product/ProductTableRow'

export { CreatorProductsLoading, CreatorProductsError }

/* -------------------------------------------------------------------------- */
/*                                Main Component                              */
/* -------------------------------------------------------------------------- */

interface CreatorShop {
  id: string
  name: string
  slug: string
}

interface PaginatedProducts {
  products: CreatorProduct[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CreatorProductsPageProps {
  shops: CreatorShop[]
  products: PaginatedProducts
  currentShopId: string | null
  initialSearch: {
    shopId?: string
    page: number
    pageSize: number
    active: 'true' | 'false' | 'all'
    search?: string
  }
}

export function CreatorProductsPage({
  shops,
  products: initialProducts,
  currentShopId,
  initialSearch,
}: CreatorProductsPageProps) {
  const router = useRouter()

  /* ---- Local state for optimistic toggles ---- */
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>({})
  const [togglingProducts, setTogglingProducts] = useState<Record<string, boolean>>({})

  /* ---- Local filter states (mirrored to search params) ---- */
  const [localSearch, setLocalSearch] = useState(initialSearch.search ?? '')
  const localSearchRef = useRef(localSearch)
  localSearchRef.current = localSearch
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const navigateWithParams = useCallback(
    (overrides: Record<string, string | number | undefined>) => {
      setToggleStates({})
      const params: Record<string, string | number> = {
        page: initialSearch.page,
        pageSize: initialSearch.pageSize,
        active: initialSearch.active,
        ...overrides,
      }

      // Include shopId only when it exists
      if (currentShopId) {
        params.shopId = currentShopId
      }

      // Only include search if non-empty
      const searchValue =
        overrides.search !== undefined ? String(overrides.search) : localSearchRef.current
      if (searchValue?.trim()) {
        params.search = searchValue
      } else {
        delete params.search
      }

      router.navigate({
        to: '/creator/products',
        search: params,
        replace: true,
      })
    },
    [currentShopId, initialSearch.pageSize, initialSearch.active, initialSearch.page, router],
  )

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value)
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        navigateWithParams({ search: value || undefined, page: 1 })
      }, 300)
    },
    [navigateWithParams],
  )

  const handleActiveFilter = useCallback(
    (active: 'true' | 'false' | 'all') => {
      navigateWithParams({ active, page: 1 })
    },
    [navigateWithParams],
  )

  const handlePageChange = useCallback(
    (newPage: number) => {
      navigateWithParams({ page: newPage })
    },
    [navigateWithParams],
  )

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      navigateWithParams({ pageSize: newSize, page: 1 })
    },
    [navigateWithParams],
  )

  const handleShopChange = useCallback(
    (newShopId: string) => {
      setToggleStates({})
      setLocalSearch('')
      router.navigate({
        to: '/creator/products',
        search: { shopId: newShopId, page: 1, pageSize: initialSearch.pageSize, active: 'all' },
        replace: true,
      })
    },
    [initialSearch.pageSize, router],
  )

  /* ---- Toggle handler ---- */
  const handleToggle = useCallback(
    async (productId: string, shopId: string, currentActive: boolean) => {
      if (!shopId) return
      const newActive = !currentActive

      // Optimistic update
      setToggleStates((prev) => ({ ...prev, [productId]: newActive }))
      setTogglingProducts((prev) => ({ ...prev, [productId]: true }))

      try {
        await toggleProductActive({ data: { productId, shopId } })
      } catch {
        // Rollback
        setToggleStates((prev) => ({ ...prev, [productId]: currentActive }))
      } finally {
        setTogglingProducts((prev) => ({ ...prev, [productId]: false }))
      }
    },
    [],
  )

  /* ---- Derived state ---- */
  const products = initialProducts.products
  const isActive = (p: CreatorProduct): boolean => {
    return toggleStates[p.id] !== undefined ? toggleStates[p.id] : p.isActive
  }
  const isToggling = (p: CreatorProduct): boolean => {
    return togglingProducts[p.id] ?? false
  }

  /* ---- No shops ---- */
  if (shops.length === 0) {
    return (
      <main className='page-wrap px-4 py-12'>
        <section className='island-shell rounded-2xl p-6 sm:p-8'>
          <div className='py-12 text-center'>
            <Package size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <h2 className='mb-2 text-xl font-semibold text-text-primary'>
              {m.creator_no_shops_title()}
            </h2>
            <p className='mx-auto max-w-md text-text-secondary'>
              {m.creator_no_shops_description()}
            </p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        {/* Header */}
        <h1 className='display-title mb-2 text-3xl font-semibold text-text-primary'>
          {m.creator_products_title()}
        </h1>
        <p className='mb-6 text-text-secondary'>{m.creator_products_description()}</p>

        {/* Shop selector */}
        <div className='mb-6'>
          <label
            htmlFor='creator-products-shop'
            className='mb-1.5 block text-sm font-medium text-text-secondary'
          >
            {m.creator_shop_select_label()}
          </label>
          <select
            id='creator-products-shop'
            value={currentShopId ?? ''}
            onChange={(e) => handleShopChange(e.target.value)}
            className='h-10 w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20 sm:max-w-xs'
          >
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search + Filter bar */}
        <div className='mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div className='relative flex-1 sm:max-w-sm'>
            <Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted' />
            <Input
              type='search'
              placeholder={m.creator_products_search_placeholder()}
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              className='pl-9'
              aria-label={m.creator_products_search_placeholder()}
            />
          </div>

          {/* Active/Inactive/All tabs */}
          <div
            className='flex gap-1 rounded-lg border border-border-default bg-surface-inset p-1'
            role='tablist'
          >
            {(['all', 'true', 'false'] as const).map((value) => {
              const isSelected = initialSearch.active === value
              const label =
                value === 'all'
                  ? m.creator_products_filter_all()
                  : value === 'true'
                    ? m.creator_products_filter_active()
                    : m.creator_products_filter_inactive()

              return (
                <button
                  key={value}
                  type='button'
                  role='tab'
                  aria-selected={isSelected}
                  onClick={() => handleActiveFilter(value)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-surface-default text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Table */}
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm'>
            <caption className='sr-only'>{m.creator_products_title()}</caption>
            <thead>
              <tr className='border-b border-border-default'>
                <th className='pb-3 pr-4 font-medium text-text-secondary'>
                  {m.creator_products_col_product()}
                </th>
                <th className='pb-3 pr-4 font-medium text-text-secondary hidden sm:table-cell'>
                  {m.creator_products_col_price()}
                </th>
                <th className='pb-3 pr-4 font-medium text-text-secondary hidden md:table-cell'>
                  {m.creator_products_col_stock()}
                </th>
                <th className='pb-3 pr-4 font-medium text-text-secondary'>
                  {m.creator_products_col_status()}
                </th>
                <th className='pb-3 font-medium text-text-secondary text-right'>
                  <span className='sr-only'>{m.creator_products_col_actions()}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <ProductTableRow
                  key={product.id}
                  product={product}
                  currentShopId={currentShopId}
                  active={isActive(product)}
                  toggling={isToggling(product)}
                  onToggle={handleToggle}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {products.length === 0 && (
          <div className='py-12 text-center'>
            <Package size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <h2 className='mb-2 text-lg font-semibold text-text-primary'>
              {initialSearch.search || initialSearch.active !== 'all'
                ? m.creator_products_no_results()
                : m.creator_products_empty_title()}
            </h2>
            <p className='text-text-secondary'>
              {initialSearch.search || initialSearch.active !== 'all'
                ? m.creator_products_no_results_description()
                : m.creator_products_empty_description()}
            </p>
          </div>
        )}

        {/* Pagination */}
        {initialProducts.totalPages > 1 && (
          <div className='mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between'>
            <p className='text-sm text-text-secondary'>
              {m.creator_products_showing({
                from: (initialProducts.page - 1) * initialProducts.pageSize + 1,
                to: Math.min(
                  initialProducts.page * initialProducts.pageSize,
                  initialProducts.total,
                ),
                total: initialProducts.total,
              })}
            </p>

            <nav className='flex items-center gap-4' aria-label={m.creator_products_pagination()}>
              <div className='flex items-center gap-2'>
                <Button
                  variant='secondary'
                  size='sm'
                  disabled={initialProducts.page <= 1}
                  onClick={() => handlePageChange(initialProducts.page - 1)}
                  aria-label={m.pagination_previous()}
                >
                  <ChevronLeft size={16} aria-hidden='true' />
                </Button>

                <span className='text-sm text-text-secondary'>
                  {m.pagination_page_of({
                    page: initialProducts.page,
                    totalPages: initialProducts.totalPages,
                  })}
                </span>

                <Button
                  variant='secondary'
                  size='sm'
                  disabled={initialProducts.page >= initialProducts.totalPages}
                  onClick={() => handlePageChange(initialProducts.page + 1)}
                  aria-label={m.pagination_next()}
                >
                  <ChevronRight size={16} aria-hidden='true' />
                </Button>
              </div>

              {/* Page size selector */}
              <div className='flex items-center gap-2'>
                <label htmlFor='creator-products-page-size' className='text-sm text-text-secondary'>
                  {m.creator_products_page_size()}
                </label>
                <select
                  id='creator-products-page-size'
                  value={initialSearch.pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className='h-6 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary'
                >
                  {[10, 20, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </nav>
          </div>
        )}
      </section>
    </main>
  )
}
