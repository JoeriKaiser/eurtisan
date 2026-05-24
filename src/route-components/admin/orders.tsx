import { useLoaderData, useNavigate, useSearch, Link } from '@tanstack/react-router'
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Inbox, Search, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import type { PaginatedAdminOrders } from '#/lib/admin-orders'
import { downloadCSV, generateCSV } from '#/lib/csv-export'
import { statusBadgeVariant } from '#/lib/orders-ui'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

const PAGE_SIZES = [10, 20, 50] as const

const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'refunded',
  'disputed',
] as const

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDate(date: Date | string): string {
  return DATE_FORMATTER.format(new Date(date))
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

const SortHeader = ({
  column,
  sortBy,
  sortDir,
  onSort,
  children,
}: {
  column: 'createdAt' | 'totalCents'
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  onSort: (column: 'createdAt' | 'totalCents') => void
  children: React.ReactNode
}) => {
  const isSorted = sortBy === column
  const dir = sortDir ?? 'desc'
  return (
    <button
      type='button'
      onClick={() => onSort(column)}
      className='flex items-center gap-1 font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer'
    >
      {children}
      {isSorted && (
        <span className='text-text-muted'>
          {dir === 'asc' ? (
            <ChevronLeft size={14} className='rotate-90' />
          ) : (
            <ChevronLeft size={14} className='-rotate-90' />
          )}
        </span>
      )}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

export function AdminOrdersPage() {
  const initialData = useLoaderData({ from: '/admin/orders' })
  const navigate = useNavigate()
  const search = useSearch({ from: '/admin/orders' })

  const [orders, _setOrders] = useState<PaginatedAdminOrders>(initialData)

  // --- Search state ---
  const [searchValue, setSearchValue] = useState(search.query ?? '')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // --- Pagination helpers ---
  const navigateWithParams = useCallback(
    (overrides: Record<string, string | number | string[]>) => {
      navigate({
        to: '/admin/orders',
        search: { ...search, ...overrides },
        replace: true,
      })
    },
    [navigate, search],
  )

  const handleSearch = useCallback(() => {
    const trimmed = searchValue.trim()
    navigateWithParams({ query: trimmed, page: 1 })
  }, [searchValue, navigateWithParams])

  const handleClearSearch = useCallback(() => {
    setSearchValue('')
    navigateWithParams({ query: '', page: 1 })
    searchInputRef.current?.focus()
  }, [navigateWithParams])

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSearch()
      }
    },
    [handleSearch],
  )

  const handleSort = useCallback(
    (column: 'createdAt' | 'totalCents') => {
      if (search.sortBy === column) {
        navigateWithParams({ sortDir: search.sortDir === 'asc' ? 'desc' : 'asc', page: 1 })
      } else {
        navigateWithParams({ sortBy: column, sortDir: 'desc', page: 1 })
      }
    },
    [navigateWithParams, search.sortBy, search.sortDir],
  )

  const handlePageChange = useCallback(
    (page: number) => {
      navigateWithParams({ page })
    },
    [navigateWithParams],
  )

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      navigateWithParams({ pageSize, page: 1 })
    },
    [navigateWithParams],
  )

  const toggleStatus = useCallback(
    (status: string) => {
      const current = search.statuses ?? []
      const next = current.includes(status)
        ? current.filter((s) => s !== status)
        : [...current, status]
      navigateWithParams({ statuses: next, page: 1 })
    },
    [navigateWithParams, search.statuses],
  )

  const handleDateChange = useCallback(
    (field: 'from' | 'to', value: string) => {
      navigateWithParams({ [field]: value, page: 1 })
    },
    [navigateWithParams],
  )

  const clearFilters = useCallback(() => {
    setSearchValue('')
    navigateWithParams({
      query: '',
      from: '',
      to: '',
      statuses: [],
      page: 1,
    })
  }, [navigateWithParams])

  const hasFilters = search.query || search.from || search.to || (search.statuses?.length ?? 0) > 0

  const handleExportCSV = useCallback(() => {
    const csv = generateCSV(orders.orders, [
      { key: 'id', label: 'Order ID' },
      { key: 'buyerName', label: 'Buyer' },
      { key: 'buyerEmail', label: 'Buyer Email' },
      { key: 'status', label: 'Status' },
      { key: 'totalCents', label: 'Total (cents)' },
      { key: 'shopCount', label: 'Shops' },
      { key: 'createdAt', label: 'Created At' },
    ])
    downloadCSV(csv, `orders-${new Date().toISOString().slice(0, 10)}.csv`)
  }, [orders.orders])

  /* ---- Compute pagination ---- */
  const totalPages = Math.max(1, Math.ceil(orders.total / orders.pageSize))

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='display-title text-3xl font-semibold text-text-primary'>
          {m.admin_orders_title()}
        </h1>
        <p className='mt-1 text-text-secondary'>{m.admin_orders_description()}</p>
      </div>

      {/* Filters */}
      <div className='flex flex-col gap-4'>
        {/* Search bar */}
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
              placeholder={m.admin_orders_search_placeholder()}
              className='h-10 w-full rounded-lg border border-border-default bg-surface-default pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
              aria-label={m.admin_orders_search_placeholder()}
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
          {hasFilters && (
            <Button variant='ghost' onClick={clearFilters}>
              {m.admin_common_clear_filters()}
            </Button>
          )}
        </div>

        {/* Date range + status filters */}
        <div className='flex flex-wrap items-end gap-3'>
          <div className='flex flex-col gap-1'>
            <label htmlFor='date-from' className='text-xs font-medium text-text-muted'>
              {m.admin_orders_date_from()}
            </label>
            <input
              id='date-from'
              type='date'
              value={search.from ?? ''}
              onChange={(e) => handleDateChange('from', e.target.value)}
              className='h-10 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
            />
          </div>
          <div className='flex flex-col gap-1'>
            <label htmlFor='date-to' className='text-xs font-medium text-text-muted'>
              {m.admin_orders_date_to()}
            </label>
            <input
              id='date-to'
              type='date'
              value={search.to ?? ''}
              onChange={(e) => handleDateChange('to', e.target.value)}
              className='h-10 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
            />
          </div>
          <div className='flex flex-col gap-1'>
            <span className='text-xs font-medium text-text-muted'>
              {m.admin_orders_status_filter()}
            </span>
            <div className='flex flex-wrap gap-1'>
              {ORDER_STATUSES.map((status) => {
                const active = search.statuses?.includes(status)
                return (
                  <button
                    key={status}
                    type='button'
                    onClick={() => toggleStatus(status)}
                    className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                        : 'border-border-default text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {statusLabel(status)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {orders.orders.length === 0 ? (
        <Card variant='elevated'>
          <CardContent className='p-8 text-center'>
            <Inbox size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <p className='text-text-secondary'>
              {search.query ? m.admin_orders_empty_search() : m.admin_orders_empty()}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm'>
            <thead>
              <tr className='border-b border-border-default'>
                <th scope='col' className='pb-3 pr-4 font-medium text-text-secondary'>
                  {m.admin_orders_col_order()}
                </th>
                <th
                  scope='col'
                  className='pb-3 pr-4 font-medium text-text-secondary hidden sm:table-cell'
                >
                  {m.admin_orders_col_buyer()}
                </th>
                <th scope='col' className='pb-3 pr-4 font-medium text-text-secondary'>
                  {m.admin_orders_col_status()}
                </th>
                <th
                  scope='col'
                  className='pb-3 pr-4 font-medium text-text-secondary hidden md:table-cell'
                >
                  {m.admin_orders_col_shops()}
                </th>
                <th scope='col' className='pb-3 pr-4'>
                  <SortHeader
                    column='totalCents'
                    sortBy={search.sortBy}
                    sortDir={search.sortDir}
                    onSort={handleSort}
                  >
                    {m.admin_orders_col_total()}
                  </SortHeader>
                </th>
                <th scope='col' className='pb-3 pr-4'>
                  <SortHeader
                    column='createdAt'
                    sortBy={search.sortBy}
                    sortDir={search.sortDir}
                    onSort={handleSort}
                  >
                    {m.admin_orders_col_date()}
                  </SortHeader>
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-border-subtle'>
              {orders.orders.map((order) => (
                <tr key={order.id} className='group transition-colors hover:bg-bg-inset/40'>
                  <td className='py-3 pr-4'>
                    <Link
                      to='/admin/orders/$platformOrderId'
                      params={{ platformOrderId: order.id }}
                      className='font-mono text-sm font-medium text-accent-primary hover:underline no-underline'
                    >
                      {order.id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className='py-3 pr-4 hidden sm:table-cell'>
                    <div>
                      <p className='font-medium text-text-primary'>{order.buyerName}</p>
                      <p className='text-xs text-text-muted'>{order.buyerEmail}</p>
                    </div>
                  </td>
                  <td className='py-3 pr-4'>
                    <Badge variant={statusBadgeVariant(order.status)}>
                      {statusLabel(order.status)}
                    </Badge>
                  </td>
                  <td className='py-3 pr-4 hidden md:table-cell'>
                    <span className='text-text-secondary'>{order.shopCount}</span>
                  </td>
                  <td className='py-3 pr-4'>
                    <span className='font-medium text-text-primary tabular-nums'>
                      {formatPriceEUR(order.totalCents)}
                    </span>
                  </td>
                  <td className='py-3 pr-4'>
                    <span className='text-text-secondary'>{formatDate(order.createdAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {orders.orders.length > 0 && (
        <div className='flex flex-col items-center gap-3 sm:flex-row sm:justify-between'>
          <div className='flex items-center gap-3'>
            <p className='text-sm text-text-secondary'>
              {m.admin_orders_showing({
                from: String((orders.page - 1) * orders.pageSize + 1),
                to: String(Math.min(orders.page * orders.pageSize, orders.total)),
                total: String(orders.total),
              })}
            </p>
            <select
              value={orders.pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className='h-6 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary'
              aria-label={m.admin_orders_page_size_label()}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          {totalPages > 1 && (
            <nav className='flex items-center gap-4' aria-label={m.admin_orders_pagination()}>
              <Button
                variant='secondary'
                size='sm'
                disabled={orders.page <= 1}
                onClick={() => handlePageChange(orders.page - 1)}
                aria-label={m.pagination_previous()}
              >
                <ChevronLeft size={16} aria-hidden='true' />
                {m.pagination_previous()}
              </Button>
              <span className='text-sm text-text-secondary'>
                {m.pagination_page_of({
                  page: String(orders.page),
                  totalPages: String(totalPages),
                })}
              </span>
              <Button
                variant='secondary'
                size='sm'
                disabled={orders.page >= totalPages}
                onClick={() => handlePageChange(orders.page + 1)}
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

/* -------------------------------------------------------------------------- */
/*                             Loading Skeleton                               */
/* -------------------------------------------------------------------------- */

export function AdminOrdersPending() {
  return (
    <div className='space-y-6'>
      <div>
        <Skeleton className='mb-2 size-9' />
        <Skeleton className='size-5' />
      </div>

      <Skeleton className='h-10 w-full rounded-lg' />
      <div className='flex gap-3'>
        <Skeleton className='size-9 rounded-md' />
        <Skeleton className='size-9 rounded-md' />
        <Skeleton className='size-9 rounded-md' />
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full text-left text-sm'>
          <thead>
            <tr className='border-b border-border-default'>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <th key={n} className='pb-3 pr-4'>
                  <Skeleton className='size-4' />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((row) => (
              <tr key={row} className='border-b border-border-subtle'>
                {[1, 2, 3, 4, 5, 6].map((col) => (
                  <td key={col} className='py-3 pr-4'>
                    <Skeleton className='size-5' />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                Error State                                 */
/* -------------------------------------------------------------------------- */

export function AdminOrdersError({ error, reset }: { error: Error; reset?: () => void }) {
  return (
    <div className='text-center py-12'>
      <AlertTriangle size={48} className='mx-auto mb-4 text-error' aria-hidden='true' />
      <h1 className='display-title mb-2 text-2xl font-semibold text-text-primary'>
        {m.admin_orders_error_load()}
      </h1>
      <p className='mb-6 text-text-secondary'>{error.message}</p>
      {reset && (
        <Button variant='secondary' onClick={reset}>
          {m.admin_orders_error_retry()}
        </Button>
      )}
    </div>
  )
}
