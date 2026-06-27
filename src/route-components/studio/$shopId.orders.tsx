import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Package, Search } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { Badge } from '#/components/ui/badge'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { getOrderStatusLabel } from '#/lib/orders-ui'
import type { OrderStatus } from '#/lib/orders.server'
import { useLoaderData, useNavigate, useParams } from '@tanstack/react-router'

const statusOptions: { value: '' | OrderStatus; label: string }[] = [
  { value: '', label: m.orderStatus_all() },
  { value: 'pending_payment', label: m.orderStatus_pending_payment() },
  { value: 'paid', label: m.orderStatus_paid() },
  { value: 'processing', label: m.orderStatus_processing() },
  { value: 'shipped', label: m.orderStatus_shipped() },
  { value: 'delivered', label: m.orderStatus_delivered() },
  { value: 'completed', label: m.orderStatus_completed() },
  { value: 'cancelled', label: m.orderStatus_cancelled() },
  { value: 'refunded', label: m.orderStatus_refunded() },
  { value: 'disputed', label: m.orderStatus_disputed() },
]

function getStatusBadgeVariant(orderStatus: string): React.ComponentProps<typeof Badge>['variant'] {
  switch (orderStatus) {
    case 'completed':
    case 'delivered':
      return 'success'
    case 'cancelled':
    case 'refunded':
    case 'disputed':
      return 'error'
    case 'shipped':
      return 'primary'
    case 'paid':
    case 'processing':
      return 'warning'
    default:
      return 'default'
  }
}

export function ShopOrdersPage() {
  const { shopId } = useParams({ from: '/studio/$shopId/orders/' })
  const { result, status, searchQuery } = useLoaderData({ from: '/studio/$shopId/orders/' })
  const navigate = useNavigate()

  const [localSearch, setLocalSearch] = useState(searchQuery ?? '')
  const [localStatus, setLocalStatus] = useState(status ?? '')

  const prevSearchQueryRef = useRef(searchQuery)
  const prevStatusRef = useRef(status)

  if (prevSearchQueryRef.current !== searchQuery) {
    setLocalSearch(searchQuery ?? '')
    prevSearchQueryRef.current = searchQuery
  }
  if (prevStatusRef.current !== status) {
    setLocalStatus(status ?? '')
    prevStatusRef.current = status
  }

  const handleNavigate = useCallback(
    (updates: { status?: string; search?: string; page?: number }) => {
      navigate({
        to: '/studio/$shopId/orders',
        params: { shopId },
        search: (prev: Record<string, unknown>) => {
          const next: Record<string, unknown> = { ...prev }
          if (updates.status !== undefined) {
            if (updates.status) next.status = updates.status
            else delete next.status
          }
          if (updates.search !== undefined) {
            if (updates.search.trim()) next.search = updates.search.trim()
            else delete next.search
          }
          if (updates.page !== undefined) {
            if (updates.page === 1) delete next.page
            else next.page = updates.page
          }
          return next
        },
      })
    },
    [navigate, shopId],
  )

  const handleSearchSubmit = useCallback(() => {
    handleNavigate({ search: localSearch, page: 1 })
  }, [handleNavigate, localSearch])

  const handleStatusChange = useCallback(
    (nextStatus: string) => {
      setLocalStatus(nextStatus)
      handleNavigate({ status: nextStatus, page: 1 })
    },
    [handleNavigate],
  )

  const handlePageChange = useCallback(
    (nextPage: number) => {
      handleNavigate({ page: nextPage })
    },
    [handleNavigate],
  )

  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-5xl'>
        <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
          <h1 className='display-title text-2xl font-semibold text-text-primary'>Shop Orders</h1>
          <Link
            to='/studio/$shopId'
            params={{ shopId }}
            className='text-sm text-text-secondary hover:text-text-primary'
          >
            Back to dashboard
          </Link>
        </div>

        {/* Filters */}
        <div className='mb-6 flex flex-col gap-3 sm:flex-row sm:items-center'>
          <div className='relative flex-1'>
            <Search
              size={16}
              className='absolute left-3 top-1/2 -translate-y-1/2 text-text-muted'
              aria-hidden='true'
            />
            <input
              type='search'
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSearchSubmit()
                }
              }}
              placeholder='Search by buyer name or order ID...'
              className='h-10 w-full rounded-lg border border-border-default bg-surface-default py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
              aria-label='Search orders'
            />
          </div>
          <select
            value={localStatus}
            onChange={(e) => handleStatusChange(e.target.value)}
            className='h-10 rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
            aria-label='Filter by status'
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Results */}
        {result.orders.length === 0 ? (
          <div className='island-shell rounded-2xl p-8 text-center'>
            <Package size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <p className='text-text-secondary'>
              {searchQuery || status ? 'No orders match your filters.' : 'No orders found.'}
            </p>
            {(searchQuery || status) && (
              <button
                type='button'
                onClick={() => {
                  setLocalSearch('')
                  setLocalStatus('')
                  handleNavigate({ search: '', status: '', page: 1 })
                }}
                className='mt-4 text-sm font-medium text-accent-primary hover:underline'
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className='space-y-4'>
            {/* Desktop table header */}
            <div className='hidden rounded-lg bg-surface-inset px-5 py-2 text-xs font-medium text-text-secondary sm:grid sm:grid-cols-[1fr_1fr_120px_100px] sm:gap-4'>
              <span>Order</span>
              <span>Buyer</span>
              <span>Status</span>
              <span className='text-right'>Total</span>
            </div>

            {result.orders.map((order) => (
              <Link
                key={order.id}
                to='/studio/$shopId/orders/$shopOrderId'
                params={{ shopId, shopOrderId: order.id }}
                className='island-shell flex flex-col gap-3 rounded-xl p-5 transition hover:bg-bg-inset sm:grid sm:grid-cols-[1fr_1fr_120px_100px] sm:items-center sm:gap-4'
              >
                <div className='space-y-1'>
                  <span className='font-mono text-sm text-text-secondary'>
                    {order.id.slice(0, 8)}…
                  </span>
                  <p className='text-xs text-text-muted'>
                    {new Date(order.createdAt).toLocaleDateString()} · {order.itemCount} items
                  </p>
                </div>
                <div>
                  <p className='text-sm text-text-primary'>{order.buyerName}</p>
                  <p className='text-xs text-text-secondary'>{order.buyerEmail}</p>
                </div>
                <div>
                  <Badge variant={getStatusBadgeVariant(order.status as OrderStatus)}>
                    {getOrderStatusLabel(order.status as OrderStatus)}
                  </Badge>
                </div>
                <div className='text-left sm:text-right'>
                  <p className='text-base font-semibold text-text-primary'>
                    {formatPriceEUR(order.totalCents)}
                  </p>
                  <p className='text-xs text-text-muted capitalize'>{order.shippingMethod}</p>
                </div>
              </Link>
            ))}

            {result.totalPages > 1 && (
              <nav
                className='flex items-center justify-center gap-2 pt-4'
                aria-label='Order pagination'
              >
                <button
                  type='button'
                  onClick={() => handlePageChange(Math.max(1, result.page - 1))}
                  disabled={result.page <= 1}
                  className='inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary transition hover:bg-bg-inset disabled:cursor-not-allowed disabled:opacity-40'
                >
                  <ChevronLeft size={16} aria-hidden='true' />
                  {m.pagination_previous()}
                </button>
                <span className='text-sm text-text-secondary'>
                  {m.pagination_page_of({ page: result.page, totalPages: result.totalPages })}
                </span>
                <button
                  type='button'
                  onClick={() => handlePageChange(Math.min(result.totalPages, result.page + 1))}
                  disabled={result.page >= result.totalPages}
                  className='inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary transition hover:bg-bg-inset disabled:cursor-not-allowed disabled:opacity-40'
                >
                  {m.pagination_next()}
                  <ChevronRight size={16} aria-hidden='true' />
                </button>
              </nav>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
