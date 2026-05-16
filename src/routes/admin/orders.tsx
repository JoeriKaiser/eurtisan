import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Search, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import type { PaginatedAdminOrders } from '#/lib/admin-orders'
import { listAllPlatformOrders } from '#/lib/admin-orders'
import { statusBadgeVariant } from '#/lib/orders-ui'
import { formatPriceEUR } from '#/lib/pricing'
import { guardRole } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

/* -------------------------------------------------------------------------- */
/*                              Route Definition                              */
/* -------------------------------------------------------------------------- */

export const Route = createFileRoute('/admin/orders')({
  beforeLoad: async () => guardRole('admin'),
  validateSearch: (search: Record<string, unknown>) => ({
    query: (search.query as string) ?? '',
    page: Number(search.page) || 1,
    pageSize: Number(search.pageSize) || 20,
  }),
  loaderDeps: ({ search: { query, page, pageSize } }) => ({
    query,
    page,
    pageSize,
  }),
  loader: async ({ deps }) => {
    return listAllPlatformOrders({
      data: {
        query: deps.query || undefined,
        page: deps.page,
        pageSize: deps.pageSize,
      },
    })
  },
  head: () => ({
    meta: [{ title: 'Order Inspector | Admin | Eurtisan' }],
  }),
  component: AdminOrdersPage,
  pendingComponent: AdminOrdersPending,
  errorComponent: AdminOrdersError,
})

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

const PAGE_SIZES = [10, 20, 50] as const

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

export function AdminOrdersPage() {
  const initialData = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()

  const [orders, _setOrders] = useState<PaginatedAdminOrders>(initialData)

  // --- Search state ---
  const [searchValue, setSearchValue] = useState(search.query ?? '')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // --- Pagination helpers ---
  const navigateWithParams = useCallback(
    (overrides: Record<string, string | number>) => {
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

  /* ---- Compute pagination ---- */
  const totalPages = Math.max(1, Math.ceil(orders.total / orders.pageSize))

  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-6xl space-y-6'>
        {/* Header */}
        <div>
          <h1 className='display-title text-3xl font-bold text-text-primary'>
            {m.admin_orders_title()}
          </h1>
          <p className='mt-1 text-text-secondary'>{m.admin_orders_description()}</p>
        </div>

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
        </div>

        {/* Active search indicator */}
        {search.query && (
          <p className='text-sm text-text-secondary'>
            {m.admin_orders_showing({
              from: String((orders.page - 1) * orders.pageSize + 1),
              to: String(Math.min(orders.page * orders.pageSize, orders.total)),
              total: String(orders.total),
            })}
          </p>
        )}

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
                  <th className='pb-3 pr-4 font-medium text-text-secondary'>
                    {m.admin_orders_col_order()}
                  </th>
                  <th className='pb-3 pr-4 font-medium text-text-secondary hidden sm:table-cell'>
                    {m.admin_orders_col_buyer()}
                  </th>
                  <th className='pb-3 pr-4 font-medium text-text-secondary'>
                    {m.admin_orders_col_status()}
                  </th>
                  <th className='pb-3 pr-4 font-medium text-text-secondary hidden md:table-cell'>
                    {m.admin_orders_col_shops()}
                  </th>
                  <th className='pb-3 pr-4 font-medium text-text-secondary hidden lg:table-cell'>
                    {m.admin_orders_col_total()}
                  </th>
                  <th className='pb-3 pr-4 font-medium text-text-secondary hidden lg:table-cell'>
                    {m.admin_orders_col_date()}
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.orders.map((order) => (
                  <tr
                    key={order.id}
                    className='border-b border-border-subtle transition-colors hover:bg-bg-inset'
                  >
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
                    <td className='py-3 pr-4 hidden lg:table-cell'>
                      <span className='font-medium text-text-primary tabular-nums'>
                        {formatPriceEUR(order.totalCents)}
                      </span>
                    </td>
                    <td className='py-3 pr-4 hidden lg:table-cell'>
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
                className='h-8 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary'
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
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*                             Loading Skeleton                               */
/* -------------------------------------------------------------------------- */

function AdminOrdersPending() {
  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-6xl space-y-6'>
        <div>
          <Skeleton className='mb-2 h-9 w-64' />
          <Skeleton className='h-5 w-80' />
        </div>

        {/* Search bar skeleton */}
        <Skeleton className='h-10 w-full rounded-lg' />

        {/* Table skeleton */}
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm'>
            <thead>
              <tr className='border-b border-border-default'>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <th key={n} className='pb-3 pr-4'>
                    <Skeleton className='h-4 w-20' />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((row) => (
                <tr key={row} className='border-b border-border-subtle'>
                  {[1, 2, 3, 4, 5, 6].map((col) => (
                    <td key={col} className='py-3 pr-4'>
                      <Skeleton className='h-5 w-24' />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*                                Error State                                 */
/* -------------------------------------------------------------------------- */

function AdminOrdersError({ error, reset }: { error: Error; reset?: () => void }) {
  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-6xl text-center'>
        <AlertTriangle size={48} className='mx-auto mb-4 text-error' aria-hidden='true' />
        <h1 className='display-title mb-2 text-2xl font-bold text-text-primary'>
          {m.admin_orders_error_load()}
        </h1>
        <p className='mb-6 text-text-secondary'>{error.message}</p>
        {reset && (
          <Button variant='secondary' onClick={reset}>
            {m.admin_orders_error_retry()}
          </Button>
        )}
      </div>
    </main>
  )
}
