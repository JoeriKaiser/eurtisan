import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertTriangle, ChevronLeft, ChevronRight, Eye, Inbox, Search, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import z from 'zod'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { cn } from '#/lib/cn'
import { listOpenDisputes } from '#/lib/disputes'
import { formatPriceEUR } from '#/lib/pricing'
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

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
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
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
              <thead>
                <tr className='border-b border-border-default'>
                  <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                    {m.admin_disputes_col_date()}
                  </th>
                  <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                    {m.admin_disputes_col_dispute_id()}
                  </th>
                  <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                    {m.admin_disputes_col_buyer()}
                  </th>
                  <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                    {m.admin_disputes_col_creator()}
                  </th>
                  <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                    {m.admin_disputes_col_reason()}
                  </th>
                  <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                    {m.admin_disputes_col_status()}
                  </th>
                  <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                    {m.admin_disputes_col_amount()}
                  </th>
                  <th scope='col' className='pb-3 text-right font-semibold text-text-secondary'>
                    {m.admin_common_actions()}
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border-subtle'>
                {disputes.map((dispute) => {
                  const statusBadge = getStatusBadge(dispute.status)
                  return (
                    <tr key={dispute.id} className='group hover:bg-bg-inset/40 transition-colors'>
                      <td className='py-3 pr-4 text-text-secondary font-mono text-xs'>
                        {formatDate(dispute.createdAt)}
                      </td>
                      <td className='py-3 pr-4'>
                        <span className='font-mono text-xs text-text-muted'>
                          {dispute.id.slice(0, 8)}…
                        </span>
                      </td>
                      <td className='py-3 pr-4 text-text-primary'>{dispute.buyerName}</td>
                      <td className='py-3 pr-4 text-text-primary'>{dispute.creatorName}</td>
                      <td className='py-3 pr-4 text-text-secondary'>
                        <span className='capitalize'>{dispute.reason.replace(/_/g, ' ')}</span>
                      </td>
                      <td className='py-3 pr-4'>
                        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                      </td>
                      <td className='py-3 pr-4 font-medium text-text-primary tabular-nums'>
                        {formatPriceEUR(dispute.orderTotalCents)}
                      </td>
                      <td className='py-3 text-right whitespace-nowrap'>
                        <Link
                          to='/admin/disputes/$disputeId'
                          params={{ disputeId: dispute.id }}
                          className='inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-inset hover:text-text-primary transition-colors'
                        >
                          <Eye size={14} aria-hidden='true' />
                          {m.admin_disputes_view()}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='flex flex-col items-center gap-3 sm:flex-row sm:justify-between'>
              <p className='text-sm text-text-secondary'>
                {m.admin_shops_showing({
                  from: (page - 1) * pageSize + 1,
                  to: Math.min(page * pageSize, total),
                  total,
                })}
              </p>
              <nav
                className='flex items-center gap-4'
                aria-label={`${m.admin_disputes_title()} pagination`}
              >
                <Button
                  variant='secondary'
                  size='sm'
                  disabled={page <= 1}
                  onClick={() => navigateWithParams({ page: page - 1 })}
                  aria-label={m.pagination_previous()}
                >
                  <ChevronLeft size={16} aria-hidden='true' />
                  {m.pagination_previous()}
                </Button>
                <span className='text-sm text-text-secondary font-mono'>
                  {m.pagination_page_of({ page, totalPages })}
                </span>
                <Button
                  variant='secondary'
                  size='sm'
                  disabled={page >= totalPages}
                  onClick={() => navigateWithParams({ page: page + 1 })}
                  aria-label={m.pagination_next()}
                >
                  {m.pagination_next()}
                  <ChevronRight size={16} aria-hidden='true' />
                </Button>
              </nav>
            </div>
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
