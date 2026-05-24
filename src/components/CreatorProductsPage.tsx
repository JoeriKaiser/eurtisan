import { Link, useRouter } from '@tanstack/react-router'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Edit,
  ImageOff,
  Package,
  Search,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { toggleProductActive } from '#/lib/creator-products'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Skeleton } from './ui/skeleton'

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

interface CreatorShop {
  id: string
  name: string
  slug: string
}

interface CreatorProduct {
  id: string
  name: string
  slug: string
  priceCents: number
  stockCount: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  thumbnailUrl: string | null
}

interface PaginatedProducts {
  products: CreatorProduct[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/* -------------------------------------------------------------------------- */
/*                                Main Component                              */
/* -------------------------------------------------------------------------- */

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
              {products.map((product) => {
                const active = isActive(product)
                const toggling = isToggling(product)

                return (
                  <tr
                    key={product.id}
                    className='border-b border-border-subtle transition-colors hover:bg-bg-inset'
                  >
                    {/* Product cell with thumbnail */}
                    <td className='py-3 pr-4'>
                      <div className='flex items-center gap-3'>
                        <div className='size-10 flex-shrink-0 overflow-hidden rounded-lg bg-surface-inset'>
                          {product.thumbnailUrl ? (
                            <img
                              src={product.thumbnailUrl}
                              alt=''
                              className='h-full w-full object-cover'
                              loading='lazy'
                            />
                          ) : (
                            <div className='flex h-full w-full items-center justify-center text-text-muted'>
                              <ImageOff size={16} aria-hidden='true' />
                            </div>
                          )}
                        </div>
                        <div className='min-w-0'>
                          <p className='font-medium text-text-primary truncate'>{product.name}</p>
                          <p className='text-xs text-text-muted sm:hidden'>
                            {formatPriceEUR(product.priceCents)}
                            <span className='mx-1.5'>·</span>
                            {m.creator_products_stock_count({ count: product.stockCount })}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Price */}
                    <td className='py-3 pr-4 hidden sm:table-cell'>
                      <span className='text-text-primary'>
                        {formatPriceEUR(product.priceCents)}
                      </span>
                    </td>

                    {/* Stock */}
                    <td className='py-3 pr-4 hidden md:table-cell'>
                      <span
                        className={
                          product.stockCount === 0
                            ? 'text-error'
                            : product.stockCount < 5
                              ? 'text-warning'
                              : 'text-text-primary'
                        }
                      >
                        {product.stockCount}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td className='py-3 pr-4'>
                      <Badge variant={active ? 'success' : 'secondary'}>
                        {active
                          ? m.creator_products_status_active()
                          : m.creator_products_status_inactive()}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className='py-3 text-right'>
                      <div className='flex items-center justify-end gap-2'>
                        {/* Toggle button */}
                        {currentShopId && (
                          <button
                            type='button'
                            onClick={() => handleToggle(product.id, currentShopId, active)}
                            disabled={toggling}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                              active
                                ? 'bg-success-subtle text-success hover:bg-success/10'
                                : 'bg-surface-inset text-text-secondary hover:bg-surface-default hover:text-text-primary'
                            } disabled:opacity-50`}
                            aria-label={
                              active
                                ? m.creator_products_deactivate({ name: product.name })
                                : m.creator_products_activate({ name: product.name })
                            }
                          >
                            {toggling ? (
                              <svg
                                className='size-4 animate-spin'
                                xmlns='http://www.w3.org/2000/svg'
                                fill='none'
                                viewBox='0 0 24 24'
                                aria-hidden='true'
                              >
                                <circle
                                  className='opacity-25'
                                  cx='12'
                                  cy='12'
                                  r='10'
                                  stroke='currentColor'
                                  strokeWidth='4'
                                />
                                <path
                                  className='opacity-75'
                                  fill='currentColor'
                                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                                />
                              </svg>
                            ) : active ? (
                              <ToggleRight size={16} aria-hidden='true' />
                            ) : (
                              <ToggleLeft size={16} aria-hidden='true' />
                            )}
                            {active ? m.creator_products_active() : m.creator_products_inactive()}
                          </button>
                        )}

                        {/* Edit link */}
                        {currentShopId && (
                          <Link
                            to='/studio/$shopId'
                            params={{ shopId: currentShopId }}
                            search={{ productId: product.id, tab: 'products' }}
                            className='inline-flex items-center justify-center rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-inset hover:text-text-primary'
                            aria-label={m.creator_products_edit({ name: product.name })}
                          >
                            <Edit size={16} aria-hidden='true' />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
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

/* -------------------------------------------------------------------------- */
/*                                Loading State                               */
/* -------------------------------------------------------------------------- */

export function CreatorProductsLoading() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <Skeleton className='mb-2 size-9' />
        <Skeleton className='mb-6 size-4' />

        <Skeleton className='mb-6 h-10 w-full sm:w-64' />

        <div className='mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <Skeleton className='h-10 w-full sm:w-80' />
          <Skeleton className='size-10' />
        </div>

        {/* Skeleton table */}
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm' aria-hidden='true'>
            <thead>
              <tr className='border-b border-border-default'>
                <th className='pb-3 pr-4'>
                  <Skeleton className='size-4' />
                </th>
                <th className='pb-3 pr-4 hidden sm:table-cell'>
                  <Skeleton className='size-4' />
                </th>
                <th className='pb-3 pr-4 hidden md:table-cell'>
                  <Skeleton className='size-4' />
                </th>
                <th className='pb-3 pr-4'>
                  <Skeleton className='size-4' />
                </th>
                <th className='pb-3'>
                  <Skeleton className='size-4 ml-auto' />
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
                <tr key={i} className='border-b border-border-subtle'>
                  <td className='py-3 pr-4'>
                    <div className='flex items-center gap-3'>
                      <Skeleton className='size-10 rounded-lg' />
                      <div className='space-y-1.5'>
                        <Skeleton className='size-4' />
                        <Skeleton className='size-3 sm:hidden' />
                      </div>
                    </div>
                  </td>
                  <td className='py-3 pr-4 hidden sm:table-cell'>
                    <Skeleton className='size-4' />
                  </td>
                  <td className='py-3 pr-4 hidden md:table-cell'>
                    <Skeleton className='size-4' />
                  </td>
                  <td className='py-3 pr-4'>
                    <Skeleton className='size-5 rounded-full' />
                  </td>
                  <td className='py-3'>
                    <Skeleton className='size-8 ml-auto' />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*                                 Error State                                */
/* -------------------------------------------------------------------------- */

export function CreatorProductsError({ error }: { error: Error }) {
  const router = useRouter()

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-6 text-3xl font-semibold text-text-primary'>
          {m.creator_products_title()}
        </h1>
        <div className='py-12 text-center'>
          <AlertTriangle size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
          <p className='text-text-secondary'>{m.creator_products_error_load()}</p>
          <p className='mt-2 text-sm text-text-muted'>{error.message}</p>
          <div className='mt-6'>
            <Button variant='secondary' onClick={() => void router.invalidate()}>
              {m.creator_error_retry()}
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
