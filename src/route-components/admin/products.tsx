import { useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  Inbox,
  Search,
  X,
} from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Select } from '#/components/ui/select'
import type { PaginatedProducts } from '#/lib/admin-products'
import { toggleProductActive } from '#/lib/admin-products'
import type { CategoryTreeNode } from '#/lib/categories'
import { cn } from '#/lib/cn'
import { downloadCSV, generateCSV } from '#/lib/csv-export'
import { MAX_BULK_SELECTION } from '#/lib/admin-constants'
import { m } from '#/paraglide/messages'
import { getImageUrl } from '#/lib/image-url'
import { SUPPORTED_CURRENCY } from '#/lib/currency'

const PAGE_SIZES = [10, 20, 50] as const
const SORTABLE_COLUMNS = ['name', 'price', 'stock', 'status'] as const
type SortableColumn = (typeof SORTABLE_COLUMNS)[number]

function SortHeader({
  column,
  sortBy,
  sortDirection,
  onSort,
  children,
}: {
  column: SortableColumn
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  onSort: (column: SortableColumn) => void
  children: React.ReactNode
}) {
  const sorted = sortBy === column
  const direction = sortDirection ?? 'desc'
  return (
    <button
      type='button'
      onClick={() => onSort(column)}
      className='flex items-center gap-1 font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer'
      aria-label={`${children}${sorted ? ` (${direction === 'asc' ? 'ascending' : 'descending'})` : ''}`}
    >
      {children}
      {sorted && (
        <span className='text-text-muted'>
          {direction === 'asc' ? (
            <ChevronLeft size={14} className='rotate-90' aria-hidden='true' />
          ) : (
            <ChevronLeft size={14} className='-rotate-90' aria-hidden='true' />
          )}
        </span>
      )}
    </button>
  )
}

/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

const PRICE_FORMATTER = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: SUPPORTED_CURRENCY,
})

function formatPrice(cents: number): string {
  return PRICE_FORMATTER.format(cents / 100)
}

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line
export function AdminProductsPage() {
  const loaderData = useLoaderData({ from: '/admin/products' })
  const navigate = useNavigate()
  const search = useSearch({ from: '/admin/products' })

  const [products, setProducts] = useState<PaginatedProducts>(loaderData.products)
  const [status, setStatus] = useState({
    actionError: null as string | null,
    successMessage: null as string | null,
  })
  const [searchValue, setSearchValue] = useState(search.query ?? '')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const [bulk, setBulk] = useState({
    selectedProductIds: new Set<string>(),
    progress: null as { current: number; total: number } | null,
  })

  const navigateWithParams = useCallback(
    (overrides: Record<string, string | number | undefined>) => {
      navigate({ to: '/admin/products', search: { ...search, ...overrides }, replace: true })
    },
    [navigate, search],
  )

  const handleSearch = useCallback(() => {
    navigateWithParams({ query: searchValue.trim(), page: 1 })
  }, [searchValue, navigateWithParams])

  const handleClearSearch = useCallback(() => {
    setSearchValue('')
    navigateWithParams({ query: undefined, page: 1 })
    searchInputRef.current?.focus()
  }, [navigateWithParams])

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleSearch()
    },
    [handleSearch],
  )

  const handlePageChange = useCallback(
    (page: number) => navigateWithParams({ page }),
    [navigateWithParams],
  )
  const handlePageSizeChange = useCallback(
    (pageSize: number) => navigateWithParams({ pageSize, page: 1 }),
    [navigateWithParams],
  )

  const handleSort = useCallback(
    (column: SortableColumn) => {
      const current = search.sortBy
      const direction = search.sortDirection ?? 'desc'
      if (current === column) {
        if (direction === 'asc') {
          navigateWithParams({ sortBy: undefined, sortDirection: undefined, page: 1 })
        } else {
          navigateWithParams({ sortBy: column, sortDirection: 'asc', page: 1 })
        }
      } else {
        navigateWithParams({ sortBy: column, sortDirection: 'desc', page: 1 })
      }
    },
    [navigateWithParams, search.sortBy, search.sortDirection],
  )

  const toggleProductSelection = useCallback((productId: string) => {
    setBulk((prev) => {
      const next = new Set(prev.selectedProductIds)
      if (next.has(productId)) next.delete(productId)
      else if (next.size < MAX_BULK_SELECTION) next.add(productId)
      return { ...prev, selectedProductIds: next }
    })
  }, [])

  const toggleAllProducts = useCallback(() => {
    setBulk((prev) => {
      if (prev.selectedProductIds.size === products.products.length) {
        return { ...prev, selectedProductIds: new Set() }
      }
      return {
        ...prev,
        selectedProductIds: new Set(
          products.products.slice(0, MAX_BULK_SELECTION).map((p) => p.id),
        ),
      }
    })
  }, [products.products])

  const handleBulkToggleActive = useCallback(async () => {
    const ids = Array.from(bulk.selectedProductIds).slice(0, MAX_BULK_SELECTION)
    if (ids.length === 0) return
    setBulk((prev) => ({ ...prev, progress: { current: 0, total: ids.length } }))
    setStatus((prev) => ({ ...prev, actionError: null }))
    let processed = 0
    await Promise.all(
      ids.map(async (productId) => {
        try {
          await toggleProductActive({ data: { productId } })
          processed++
          setBulk((prev) => ({ ...prev, progress: { current: processed, total: ids.length } }))
        } catch {
          // Continue with remaining items
        }
      }),
    )
    setBulk({ selectedProductIds: new Set(), progress: null })
    navigateWithParams({ page: 1 })
  }, [bulk.selectedProductIds, navigateWithParams])

  const showSuccess = useCallback((message: string) => {
    setStatus((prev) => ({ ...prev, successMessage: message }))
    if (successTimerRef.current) clearTimeout(successTimerRef.current)
    successTimerRef.current = setTimeout(
      () => setStatus((prev) => ({ ...prev, successMessage: null })),
      3000,
    )
  }, [])

  const handleToggleActive = useCallback(
    async (productId: string, name: string) => {
      setStatus((prev) => ({ ...prev, actionError: null }))
      try {
        const result = await toggleProductActive({ data: { productId } })
        setProducts((prev) => ({
          ...prev,
          products: prev.products.map((p) =>
            p.id === productId ? { ...p, isActive: result.isActive } : p,
          ),
        }))
        showSuccess(
          result.isActive
            ? m.admin_products_activated_success({ name })
            : m.admin_products_deactivated_success({ name }),
        )
      } catch (err) {
        setStatus((prev) => ({
          ...prev,
          actionError: err instanceof Error ? err.message : m.admin_products_action_error(),
        }))
      }
    },
    [showSuccess],
  )

  const totalPages = Math.max(1, Math.ceil(products.total / products.pageSize))

  const handleExportCSV = useCallback(() => {
    const csv = generateCSV(products.products, [
      { key: 'name', label: 'Name' },
      { key: 'slug', label: 'Slug' },
      { key: 'shopName', label: 'Shop' },
      { key: 'categoryName', label: 'Category' },
      { key: 'priceCents', label: 'Price (cents)' },
      { key: 'stockCount', label: 'Stock' },
      { key: 'isActive', label: 'Active' },
    ])
    downloadCSV(csv, `products-${new Date().toISOString().slice(0, 10)}.csv`)
  }, [products.products])

  const allShops = loaderData.shops
  const allCategories = useMemo(() => {
    function flatten(
      nodes: CategoryTreeNode[],
    ): Array<{ id: string; name: string; depth: number }> {
      const result: Array<{ id: string; name: string; depth: number }> = []
      function walk(nodes: CategoryTreeNode[], depth: number) {
        for (const node of nodes) {
          result.push({ id: node.id, name: node.name, depth })
          walk(node.children, depth + 1)
        }
      }
      walk(nodes, 0)
      return result
    }
    return flatten(loaderData.categories as CategoryTreeNode[])
  }, [loaderData.categories])

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='display-title text-3xl font-semibold text-text-primary'>
          {m.admin_products_title()}
        </h1>
        <p className='mt-1 text-text-secondary'>{m.admin_products_description()}</p>
      </div>

      {status.successMessage && (
        <div className='island-shell rounded-xl border border-success/30 bg-success-subtle p-4 text-sm text-success'>
          <CheckCircle size={16} className='mr-2 inline-block' aria-hidden='true' />
          {status.successMessage}
        </div>
      )}

      {status.actionError && (
        <div
          role='alert'
          className='island-shell rounded-xl border border-error/30 bg-error-subtle p-4 text-sm text-error'
        >
          <AlertTriangle size={16} className='mr-2 inline-block' aria-hidden='true' />
          {status.actionError}
          <button
            type='button'
            onClick={() => setStatus((prev) => ({ ...prev, actionError: null }))}
            className='ml-2 underline hover:no-underline cursor-pointer'
          >
            {m.admin_shops_dismiss()}
          </button>
        </div>
      )}

      {/* Search */}
      <div className='flex gap-2'>
        <div className='relative flex-1'>
          <Search
            size={18}
            className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted'
            aria-hidden='true'
          />
          <input
            ref={searchInputRef}
            type='text'
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={m.admin_products_search_placeholder()}
            className='h-10 w-full rounded-lg border border-border-default bg-surface-default pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
            aria-label={m.admin_products_search_placeholder()}
          />
          {searchValue && (
            <button
              type='button'
              onClick={handleClearSearch}
              className='absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:text-text-primary transition-colors'
              aria-label={m.admin_orders_clear_search()}
            >
              <X size={16} aria-hidden='true' />
            </button>
          )}
        </div>
        <Button onClick={handleSearch} aria-label={m.admin_orders_search_button()}>
          {m.admin_orders_search_button()}
        </Button>
        <Button
          variant='secondary'
          onClick={handleExportCSV}
          aria-label={m.admin_common_export_csv()}
        >
          <Download size={16} aria-hidden='true' />
          {m.admin_common_export_csv()}
        </Button>
      </div>

      {/* Filters */}
      <div className='flex flex-wrap items-end gap-3'>
        <div className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-text-muted'>
            {m.admin_products_filter_shop()}
          </span>
          <Select
            value={search.shopId ?? ''}
            onChange={(e) => navigateWithParams({ shopId: e.target.value || undefined, page: 1 })}
            className='h-9 sm:w-48'
          >
            <option value=''>{m.admin_products_filter_all_shops()}</option>
            {allShops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        <div className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-text-muted'>
            {m.admin_products_filter_category()}
          </span>
          <Select
            value={search.categoryId ?? ''}
            onChange={(e) =>
              navigateWithParams({ categoryId: e.target.value || undefined, page: 1 })
            }
            className='h-9 sm:w-56'
          >
            <option value=''>{m.admin_products_filter_all_categories()}</option>
            {allCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {'\u00A0\u00A0'.repeat(c.depth) + c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-text-muted'>
            {m.admin_products_filter_status()}
          </span>
          <Select
            value={search.status ?? ''}
            onChange={(e) => navigateWithParams({ status: e.target.value || undefined, page: 1 })}
            className='h-9 sm:w-40'
          >
            <option value=''>{m.admin_products_filter_all_statuses()}</option>
            <option value='active'>{m.admin_products_status_active()}</option>
            <option value='inactive'>{m.admin_products_status_inactive()}</option>
          </Select>
        </div>

        <div className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-text-muted'>
            {m.admin_products_filter_price_min()}
          </span>
          <input
            type='number'
            min={0}
            value={search.minPrice ?? ''}
            onChange={(e) =>
              navigateWithParams({
                minPrice: e.target.value ? Number(e.target.value) : undefined,
                page: 1,
              })
            }
            aria-label={m.admin_products_filter_price_min()}
            className='h-9 w-24 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
          />
        </div>

        <div className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-text-muted'>
            {m.admin_products_filter_price_max()}
          </span>
          <input
            type='number'
            min={0}
            value={search.maxPrice ?? ''}
            onChange={(e) =>
              navigateWithParams({
                maxPrice: e.target.value ? Number(e.target.value) : undefined,
                page: 1,
              })
            }
            aria-label={m.admin_products_filter_price_max()}
            className='h-9 w-24 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {bulk.selectedProductIds.size > 0 && (
        <div className='flex items-center justify-between rounded-lg border border-border-default bg-surface-inset px-4 py-2'>
          <span className='text-sm text-text-secondary'>
            {m.admin_bulk_selected({ count: bulk.selectedProductIds.size })}
          </span>
          <Button
            variant='primary'
            size='sm'
            onClick={handleBulkToggleActive}
            disabled={!!bulk.progress}
          >
            {m.admin_bulk_toggle_active()}
          </Button>
        </div>
      )}

      {/* Bulk progress */}
      {bulk.progress && (
        <div className='text-sm text-text-secondary'>
          {m.admin_bulk_progress({
            current: bulk.progress.current,
            total: bulk.progress.total,
          })}
        </div>
      )}

      {/* Table */}
      {products.products.length === 0 ? (
        <Card variant='elevated'>
          <CardContent className='p-8 text-center'>
            <Inbox size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <p className='text-text-secondary'>{m.admin_products_empty()}</p>
          </CardContent>
        </Card>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm'>
            <thead>
              <tr className='border-b border-border-default'>
                <th scope='col' className='pb-3 pr-2'>
                  <input
                    type='checkbox'
                    checked={
                      bulk.selectedProductIds.size > 0 &&
                      bulk.selectedProductIds.size === products.products.length
                    }
                    onChange={toggleAllProducts}
                    className='size-4 rounded border-border-default'
                    aria-label={m.data_table_select_all()}
                  />
                </th>
                <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                  <SortHeader
                    column='name'
                    sortBy={search.sortBy}
                    sortDirection={search.sortDirection}
                    onSort={handleSort}
                  >
                    {m.admin_products_col_product()}
                  </SortHeader>
                </th>
                <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                  {m.admin_products_col_shop()}
                </th>
                <th
                  scope='col'
                  className='pb-3 pr-4 font-semibold text-text-secondary hidden sm:table-cell'
                >
                  {m.admin_products_col_category()}
                </th>
                <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                  <SortHeader
                    column='price'
                    sortBy={search.sortBy}
                    sortDirection={search.sortDirection}
                    onSort={handleSort}
                  >
                    {m.admin_products_col_price()}
                  </SortHeader>
                </th>
                <th
                  scope='col'
                  className='pb-3 pr-4 font-semibold text-text-secondary hidden md:table-cell'
                >
                  <SortHeader
                    column='stock'
                    sortBy={search.sortBy}
                    sortDirection={search.sortDirection}
                    onSort={handleSort}
                  >
                    {m.admin_products_col_stock()}
                  </SortHeader>
                </th>
                <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                  <SortHeader
                    column='status'
                    sortBy={search.sortBy}
                    sortDirection={search.sortDirection}
                    onSort={handleSort}
                  >
                    {m.admin_products_col_status()}
                  </SortHeader>
                </th>
                <th scope='col' className='pb-3 text-right font-semibold text-text-secondary'>
                  {m.admin_common_actions()}
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-border-subtle'>
              {products.products.map((p) => (
                <tr key={p.id} className='group hover:bg-bg-inset/40 transition-colors'>
                  <td className='py-3 pr-2'>
                    <input
                      type='checkbox'
                      checked={bulk.selectedProductIds.has(p.id)}
                      onChange={() => toggleProductSelection(p.id)}
                      className='size-4 rounded border-border-default'
                      aria-label={m.data_table_select_row()}
                    />
                  </td>
                  <td className='py-3 pr-4'>
                    <div className='flex items-center gap-3'>
                      {p.thumbnailUrl ? (
                        <img
                          src={getImageUrl(p.thumbnailUrl, { width: 80, format: 'webp' })}
                          alt=''
                          className='size-10 rounded-lg object-cover border border-border-default flex-shrink-0'
                        />
                      ) : (
                        <div className='size-10 rounded-lg bg-surface-inset border border-border-subtle flex items-center justify-center text-text-muted text-xs flex-shrink-0'>
                          N/A
                        </div>
                      )}
                      <div className='flex flex-col min-w-0'>
                        <span className='font-medium text-text-primary truncate'>{p.name}</span>
                        <span className='font-mono text-xs text-text-muted truncate'>
                          /{p.slug}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className='py-3 pr-4 text-text-primary'>{p.shopName}</td>
                  <td className='py-3 pr-4 text-text-secondary hidden sm:table-cell'>
                    {p.categoryName ?? <span className='text-text-muted'>(none)</span>}
                  </td>
                  <td className='py-3 pr-4 font-medium text-text-primary tabular-nums'>
                    {formatPrice(p.priceCents)}
                  </td>
                  <td className='py-3 pr-4 text-text-secondary hidden md:table-cell'>
                    {p.stockCount}
                  </td>
                  <td className='py-3 pr-4'>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border',
                        p.isActive
                          ? 'bg-success/10 text-success border-success/20'
                          : 'bg-surface-inset text-text-secondary border-border-default',
                      )}
                    >
                      {p.isActive
                        ? m.admin_products_status_active()
                        : m.admin_products_status_inactive()}
                    </span>
                  </td>
                  <td className='py-3 text-right whitespace-nowrap'>
                    <div className='flex items-center justify-end gap-2'>
                      <a
                        href={`/shops/${p.shopSlug}/products/${p.slug}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-inset hover:text-text-primary transition-colors'
                      >
                        <Eye size={14} aria-hidden='true' />
                        {m.admin_products_view()}
                        <ExternalLink size={12} aria-hidden='true' />
                      </a>
                      <Button
                        variant={p.isActive ? 'secondary' : 'primary'}
                        size='sm'
                        onClick={() => handleToggleActive(p.id, p.name)}
                      >
                        {p.isActive ? m.admin_products_deactivate() : m.admin_products_activate()}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {products.products.length > 0 && (
        <div className='flex flex-col items-center gap-3 sm:flex-row sm:justify-between'>
          <div className='flex items-center gap-3'>
            <p className='text-sm text-text-secondary'>
              {m.admin_shops_showing({
                from: (products.page - 1) * products.pageSize + 1,
                to: Math.min(products.page * products.pageSize, products.total),
                total: products.total,
              })}
            </p>
            <select
              value={products.pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className='h-6 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none cursor-pointer'
              aria-label={m.admin_shops_page_size_label()}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          {totalPages > 1 && (
            <nav className='flex items-center gap-4' aria-label={m.admin_shops_pagination()}>
              <Button
                variant='secondary'
                size='sm'
                disabled={products.page <= 1}
                onClick={() => handlePageChange(products.page - 1)}
                aria-label={m.pagination_previous()}
              >
                <ChevronLeft size={16} aria-hidden='true' />
                {m.pagination_previous()}
              </Button>
              <span className='text-sm text-text-secondary font-mono'>
                {m.pagination_page_of({ page: products.page, totalPages })}
              </span>
              <Button
                variant='secondary'
                size='sm'
                disabled={products.page >= totalPages}
                onClick={() => handlePageChange(products.page + 1)}
                aria-label={m.pagination_next()}
              >
                {m.pagination_next()}
                <ChevronRight size={16} aria-hidden='true' />
              </Button>
            </nav>
          )}
        </div>
      )}
    </div>
  )
}
