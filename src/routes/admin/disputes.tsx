import { createFileRoute, Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Hash,
  Inbox,
  Search,
  User,
  X,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import z from 'zod'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { cn } from '#/lib/cn'
import { listOpenDisputes } from '#/lib/disputes'
import { m } from '#/paraglide/messages'

const PAGE_SIZE = 20

const disputesSearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  status: z.enum(['all', 'open', 'resolved']).optional().default('open'),
  query: z.string().optional().default(''),
})

export const Route = createFileRoute('/admin/disputes')({
  validateSearch: disputesSearchSchema,
  loaderDeps: ({ search: { page, status, query } }) => ({ page, status, query }),
  loader: async ({ deps }) => {
    const result = await listOpenDisputes({
      data: {
        page: deps.page,
        pageSize: PAGE_SIZE,
        status: deps.status,
        query: deps.query || undefined,
      },
    })
    return result
  },
  head: () => ({
    meta: [{ title: 'Disputes | Admin' }],
  }),
  component: AdminDisputesPage,
  pendingComponent: AdminDisputesPending,
  errorComponent: AdminDisputesError,
})

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function getStatusBadge(status: string): { variant: 'warning' | 'success'; label: string } {
  if (status === 'open') return { variant: 'warning', label: m.admin_disputes_tab_open() }
  if (status === 'resolved') return { variant: 'success', label: m.admin_disputes_tab_resolved() }
  return { variant: 'warning', label: status }
}

function getDisputeAge(createdAt: Date | string): string {
  const created = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffDays > 0) return `${diffDays}d`
  if (diffHours > 0) return `${diffHours}h`
  return `${diffMinutes}m`
}

/* -------------------------------------------------------------------------- */
/*                              Main Component                                */
/* -------------------------------------------------------------------------- */

export function AdminDisputesPage() {
  const result = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const { disputes, total, page, pageSize } = result
  const totalPages = Math.ceil(total / pageSize)

  const [searchValue, setSearchValue] = useState(search.query ?? '')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const navigateWithParams = useCallback(
    (overrides: Record<string, string | number>) => {
      navigate({
        to: '/admin/disputes',
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

  const handleTabChange = useCallback(
    (status: 'all' | 'open' | 'resolved') => {
      navigateWithParams({ status, page: 1 })
    },
    [navigateWithParams],
  )

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='display-title text-3xl font-bold text-text-primary'>
          {m.admin_disputes_title()}
        </h1>
        <p className='mt-1 text-text-secondary'>{m.admin_disputes_description()}</p>
      </div>

      {/* Status tabs */}
      <div
        className='flex gap-1 rounded-lg border border-border-default bg-surface-inset p-1 w-fit'
        role='tablist'
        aria-label={m.admin_common_filter()}
      >
        {(['open', 'resolved', 'all'] as const).map((status) => {
          const isSelected = search.status === status
          return (
            <button
              key={status}
              type='button'
              role='tab'
              aria-selected={isSelected}
              onClick={() => handleTabChange(status)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer',
                isSelected
                  ? 'bg-surface-default text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {status === 'open'
                ? m.admin_disputes_tab_open()
                : status === 'resolved'
                  ? m.admin_disputes_tab_resolved()
                  : m.admin_disputes_tab_all()}
            </button>
          )
        })}
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
            placeholder={m.admin_disputes_search_placeholder()}
            className='h-10 w-full rounded-lg border border-border-default bg-surface-default pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
            aria-label={m.admin_disputes_search_placeholder()}
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
        <Button onClick={handleSearch} aria-label={m.admin_common_search()}>
          {m.admin_common_search()}
        </Button>
      </div>

      {/* Results */}
      {disputes.length === 0 ? (
        <Card variant='elevated'>
          <CardContent className='p-8 text-center'>
            <Inbox size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <p className='text-lg font-medium text-text-primary'>
              {search.query ? m.admin_disputes_empty_search() : m.admin_disputes_title()}
            </p>
            <p className='mt-1 text-sm text-text-secondary'>
              {search.query
                ? m.admin_disputes_empty_search()
                : 'When buyers open disputes, they will appear here.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-4'>
          {/* Desktop table header */}
          <div className='hidden rounded-lg bg-surface-inset px-5 py-2 text-xs font-medium text-text-secondary sm:grid sm:grid-cols-[80px_1fr_1fr_1fr_1fr_80px_100px] sm:gap-4'>
            <span>{m.admin_orders_col_date()}</span>
            <span className='flex items-center gap-1'>
              <Hash size={12} aria-hidden='true' />
              Dispute ID
            </span>
            <span className='flex items-center gap-1'>
              <User size={12} aria-hidden='true' />
              Buyer
            </span>
            <span className='flex items-center gap-1'>
              <User size={12} aria-hidden='true' />
              Creator
            </span>
            <span>Order Ref</span>
            <span>Status</span>
            <span />
          </div>

          {/* Dispute rows */}
          {disputes.map((dispute) => {
            const statusBadge = getStatusBadge(dispute.status)
            return (
              <Link
                key={dispute.id}
                to='/admin/disputes/$disputeId'
                params={{ disputeId: dispute.id }}
                className='island-shell flex flex-col gap-3 rounded-xl p-5 transition hover:bg-bg-inset sm:grid sm:grid-cols-[80px_1fr_1fr_1fr_1fr_80px_100px] sm:items-center sm:gap-4'
              >
                {/* Age */}
                <div className='flex items-center gap-2'>
                  <Clock size={14} className='text-text-muted' aria-hidden='true' />
                  <span className='font-mono text-sm text-text-secondary'>
                    {getDisputeAge(dispute.createdAt)}
                  </span>
                </div>

                {/* Dispute ID */}
                <div>
                  <span className='font-mono text-xs text-text-muted'>
                    {dispute.id.slice(0, 8)}…
                  </span>
                </div>

                {/* Buyer */}
                <div>
                  <p className='text-sm text-text-primary'>{dispute.buyerName}</p>
                </div>

                {/* Creator */}
                <div>
                  <p className='text-sm text-text-primary'>{dispute.creatorName}</p>
                </div>

                {/* Order Ref */}
                <div>
                  <span className='font-mono text-sm text-text-secondary'>
                    {dispute.shopOrderId.slice(0, 8)}…
                  </span>
                </div>

                {/* Status */}
                <div>
                  <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                </div>

                {/* Arrow indicator */}
                <div className='flex justify-end'>
                  <ChevronRight size={18} className='text-text-muted' aria-hidden='true' />
                </div>
              </Link>
            )
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav
              className='flex items-center justify-between gap-4 pt-2'
              aria-label='Dispute queue pagination'
            >
              <div className='text-sm text-text-muted'>
                Page {page} of {totalPages}
              </div>
              <div className='flex items-center gap-2'>
                <Link
                  to='/admin/disputes'
                  search={{ page: page - 1, status: search.status, query: search.query }}
                  disabled={page <= 1}
                  className='inline-flex items-center gap-1 rounded-lg border border-border-default px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-inset aria-disabled:pointer-events-none aria-disabled:opacity-40'
                  aria-disabled={page <= 1}
                  aria-label={m.pagination_previous()}
                >
                  <ChevronLeft size={16} aria-hidden='true' />
                  {m.pagination_previous()}
                </Link>
                <Link
                  to='/admin/disputes'
                  search={{ page: page + 1, status: search.status, query: search.query }}
                  disabled={page >= totalPages}
                  className='inline-flex items-center gap-1 rounded-lg border border-border-default px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-inset aria-disabled:pointer-events-none aria-disabled:opacity-40'
                  aria-disabled={page >= totalPages}
                  aria-label={m.pagination_next()}
                >
                  {m.pagination_next()}
                  <ChevronRight size={16} aria-hidden='true' />
                </Link>
              </div>
            </nav>
          )}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                             Pending Component                              */
/* -------------------------------------------------------------------------- */

function AdminDisputesPending() {
  return (
    <div className='space-y-6'>
      <div>
        <Skeleton className='mb-2 h-9 w-64' />
        <Skeleton className='h-5 w-80' />
      </div>
      <Skeleton className='h-10 w-48 rounded-lg' />
      <Skeleton className='h-10 w-full rounded-lg' />
      <div className='space-y-4'>
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} className='h-20 rounded-xl' />
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                              Error Component                               */
/* -------------------------------------------------------------------------- */

function AdminDisputesError({ error }: { error: Error }) {
  return (
    <div className='text-center py-12'>
      <AlertTriangle size={48} className='mx-auto mb-4 text-error' aria-hidden='true' />
      <h1 className='display-title mb-4 text-2xl font-bold text-text-primary'>
        Failed to load disputes
      </h1>
      <p className='mb-6 text-text-secondary'>{error.message}</p>
    </div>
  )
}
