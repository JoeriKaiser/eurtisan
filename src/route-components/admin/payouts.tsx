import { useLoaderData, useNavigate, useSearch, Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  Banknote,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Inbox,
  Search,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import type { AdminPayoutRow } from '#/lib/admin-payouts'
import { markPayoutSent } from '#/lib/admin-payouts'
import { cn } from '#/lib/cn'
import { downloadCSV, generateCSV } from '#/lib/csv-export'
import { formatPriceEUR } from '#/lib/pricing'
// type Tab is used below
type Tab = 'pending' | 'history'

import { m } from '#/paraglide/messages'
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

const PAGE_SIZES = [10, 20, 50] as const

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDate(date: Date | string | null): string {
  if (!date) return '—'
  return DATE_FORMATTER.format(new Date(date))
}

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

export function AdminPayoutsPage() {
  const initialData = useLoaderData({ from: '/admin/payouts' })
  const navigate = useNavigate()
  const search = useSearch({ from: '/admin/payouts' })

  // Derive history data fresh on every render so pagination works.
  const historyData = initialData.tab === 'history' ? initialData.history : null

  // --- Local state ---
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>(
    initialData.tab === 'pending' ? initialData.payouts : [],
  )
  const [actionPayoutId, setActionPayoutId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Search state
  const [searchValue, setSearchValue] = useState(search.query ?? '')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Keep payouts in sync when the loader returns fresh pending data (tab switch, remount).
  useEffect(() => {
    if (initialData.tab === 'pending') {
      setPayouts(initialData.payouts)
    }
  }, [initialData.tab, initialData.payouts])

  // --- Refs for stale-closure safety ---
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  /* ---- Navigation helpers ---- */
  const navigateWithParams = useCallback(
    (overrides: Record<string, string | number>) => {
      navigate({
        to: '/admin/payouts',
        search: { ...search, ...overrides },
        replace: true,
      })
    },
    [navigate, search],
  )

  const handleTabChange = useCallback(
    (tab: Tab) => {
      navigate({ to: '/admin/payouts', search: { tab, page: 1, pageSize: 20 }, replace: true })
    },
    [navigate],
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

  const handleDateChange = useCallback(
    (field: 'from' | 'to', value: string) => {
      navigateWithParams({ [field]: value, page: 1 })
    },
    [navigateWithParams],
  )

  const clearFilters = useCallback(() => {
    setSearchValue('')
    navigateWithParams({ query: '', from: '', to: '', page: 1 })
  }, [navigateWithParams])

  /* ---- Mark as sent ---- */
  const handleMarkSent = useCallback(async (payoutId: string) => {
    setActionPayoutId(payoutId)
    setActionError(null)
    setSuccessMessage(null)

    try {
      await markPayoutSent({ data: { payoutId } })

      // Remove from the pending list immediately
      setPayouts((prev) => prev.filter((p) => p.payoutId !== payoutId))

      setSuccessMessage(m.admin_payouts_marked_sent_success())

      if (successTimerRef.current) clearTimeout(successTimerRef.current)
      successTimerRef.current = setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : m.admin_payouts_action_error())
    } finally {
      setActionPayoutId(null)
    }
  }, [])

  /* ---- Derived data ---- */
  const currentTab = search.tab as Tab
  const isPendingTab = currentTab === 'pending'
  const totalPages = historyData && historyData.totalPages > 0 ? historyData.totalPages : 1
  const showingFrom = historyData ? (historyData.page - 1) * historyData.pageSize + 1 : 0
  const showingTo = historyData
    ? Math.min(historyData.page * historyData.pageSize, historyData.total)
    : 0

  const hasFilters = search.query || search.from || search.to

  const handleExportCSV = useCallback(() => {
    if (!historyData) return
    const csv = generateCSV(historyData.payouts, [
      { key: 'creatorName', label: 'Creator' },
      { key: 'shopName', label: 'Shop' },
      { key: 'amountCents', label: 'Amount (cents)' },
      { key: 'status', label: 'Status' },
      { key: 'sentAt', label: 'Sent At' },
      { key: 'createdAt', label: 'Created At' },
    ])
    downloadCSV(csv, `payouts-${new Date().toISOString().slice(0, 10)}.csv`)
  }, [historyData])

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='display-title text-3xl font-semibold text-text-primary'>
          {m.admin_payouts_title()}
        </h1>
        <p className='mt-1 text-text-secondary'>{m.admin_payouts_description()}</p>
      </div>

      {/* Success / Error feedback */}
      {successMessage && (
        <div className='island-shell rounded-xl border border-success/30 bg-success-subtle p-4 text-sm text-success'>
          <CheckCircle size={16} className='mr-2 inline-block' aria-hidden='true' />
          {successMessage}
        </div>
      )}

      {actionError && (
        <div
          role='alert'
          className='island-shell rounded-xl border border-error/30 bg-error-subtle p-4 text-sm text-error'
        >
          <AlertTriangle size={16} className='mr-2 inline-block' aria-hidden='true' />
          {actionError}
          <button
            type='button'
            onClick={() => setActionError(null)}
            className='ml-2 underline hover:no-underline'
          >
            {m.admin_payouts_dismiss()}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div
        className='flex gap-1 rounded-lg border border-border-default bg-surface-inset p-1 w-fit'
        role='tablist'
        aria-label={m.admin_payouts_tab_label()}
      >
        <button
          type='button'
          role='tab'
          aria-selected={isPendingTab}
          onClick={() => handleTabChange('pending')}
          className={cn(
            'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            isPendingTab
              ? 'bg-surface-default text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          {m.admin_payouts_tab_pending()}
        </button>
        <button
          type='button'
          role='tab'
          aria-selected={!isPendingTab}
          onClick={() => handleTabChange('history')}
          className={cn(
            'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            !isPendingTab
              ? 'bg-surface-default text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          {m.admin_payouts_tab_history()}
        </button>
      </div>

      {/* History filters */}
      {!isPendingTab && (
        <div className='flex flex-col gap-3'>
          <div className='flex flex-wrap items-end gap-3'>
            <div className='relative flex-1 min-w-[200px]'>
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
                placeholder={m.admin_payouts_search_placeholder()}
                className='h-10 w-full rounded-lg border border-border-default bg-surface-default pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
                aria-label={m.admin_payouts_search_placeholder()}
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
            <Button onClick={handleSearch}>{m.admin_common_search()}</Button>
            {!isPendingTab && historyData && historyData.payouts.length > 0 && (
              <Button
                variant='secondary'
                onClick={handleExportCSV}
                aria-label={m.admin_common_export_csv()}
              >
                <Download size={16} aria-hidden='true' />
                {m.admin_common_export_csv()}
              </Button>
            )}
            {hasFilters && (
              <Button variant='ghost' onClick={clearFilters}>
                {m.admin_common_clear_filters()}
              </Button>
            )}
          </div>
          <div className='flex flex-wrap items-end gap-3'>
            <div className='flex flex-col gap-1'>
              <label htmlFor='payout-date-from' className='text-xs font-medium text-text-muted'>
                {m.admin_orders_date_from()}
              </label>
              <input
                id='payout-date-from'
                type='date'
                value={search.from ?? ''}
                onChange={(e) => handleDateChange('from', e.target.value)}
                className='h-9 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
              />
            </div>
            <div className='flex flex-col gap-1'>
              <label htmlFor='payout-date-to' className='text-xs font-medium text-text-muted'>
                {m.admin_orders_date_to()}
              </label>
              <input
                id='payout-date-to'
                type='date'
                value={search.to ?? ''}
                onChange={(e) => handleDateChange('to', e.target.value)}
                className='h-9 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
              />
            </div>
          </div>
        </div>
      )}

      {/* ---- Pending Tab ---- */}
      {isPendingTab &&
        (payouts.length === 0 ? (
          <div className='py-16 text-center'>
            <Banknote size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <h2 className='mb-2 text-lg font-semibold text-text-primary'>
              {m.admin_payouts_pending_empty()}
            </h2>
            <p className='text-text-secondary'>{m.admin_payouts_pending_empty_desc()}</p>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
              <thead>
                <tr className='border-b border-border-default'>
                  <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                    {m.admin_payouts_col_creator()}
                  </th>
                  <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                    {m.admin_payouts_col_shop()}
                  </th>
                  <th
                    scope='col'
                    className='pb-3 pr-4 font-semibold text-text-secondary text-right'
                  >
                    {m.admin_payouts_col_amount()}
                  </th>
                  <th
                    scope='col'
                    className='pb-3 pr-4 font-semibold text-text-secondary hidden sm:table-cell'
                  >
                    {m.admin_payouts_col_created()}
                  </th>
                  <th scope='col' className='pb-3 font-semibold text-text-secondary text-right'>
                    <span className='sr-only'>{m.admin_payouts_col_actions()}</span>
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border-subtle'>
                {payouts.map((payout) => {
                  const isProcessing = actionPayoutId === payout.payoutId

                  return (
                    <tr
                      key={payout.payoutId}
                      className='group transition-colors hover:bg-bg-inset/40'
                    >
                      {/* Creator */}
                      <td className='py-3 pr-4'>
                        <span className='font-medium text-text-primary'>{payout.creatorName}</span>
                      </td>

                      {/* Shop — links to shop moderation */}
                      <td className='py-3 pr-4'>
                        <Link
                          to='/admin/shops'
                          search={{ filter: 'all' }}
                          className='text-sm text-accent-primary hover:underline'
                        >
                          {payout.shopName}
                        </Link>
                      </td>

                      {/* Amount */}
                      <td className='py-3 pr-4 text-right font-semibold tabular-nums text-text-primary'>
                        {formatPriceEUR(payout.amountCents)}
                      </td>

                      {/* Created */}
                      <td className='py-3 pr-4 hidden sm:table-cell text-text-secondary'>
                        {formatDate(payout.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className='py-3 text-right'>
                        <Button
                          variant='primary'
                          size='sm'
                          onClick={() => handleMarkSent(payout.payoutId)}
                          disabled={isProcessing}
                          isLoading={isProcessing}
                          aria-label={m.admin_payouts_mark_sent_aria({
                            creator: payout.creatorName,
                          })}
                        >
                          {m.admin_payouts_mark_sent()}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}

      {/* ---- History Tab ---- */}
      {!isPendingTab &&
        (!historyData || historyData.payouts.length === 0 ? (
          <div className='py-16 text-center'>
            <Inbox size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <h2 className='mb-2 text-lg font-semibold text-text-primary'>
              {m.admin_payouts_history_empty()}
            </h2>
            <p className='text-text-secondary'>{m.admin_payouts_history_empty_desc()}</p>
          </div>
        ) : (
          <>
            <div className='overflow-x-auto'>
              <table className='w-full text-left text-sm'>
                <thead>
                  <tr className='border-b border-border-default'>
                    <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                      {m.admin_payouts_col_creator()}
                    </th>
                    <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                      {m.admin_payouts_col_shop()}
                    </th>
                    <th
                      scope='col'
                      className='pb-3 pr-4 font-semibold text-text-secondary text-right'
                    >
                      {m.admin_payouts_col_amount()}
                    </th>
                    <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                      {m.admin_payouts_col_status()}
                    </th>
                    <th
                      scope='col'
                      className='pb-3 pr-4 font-semibold text-text-secondary hidden md:table-cell'
                    >
                      {m.admin_payouts_col_sent_at()}
                    </th>
                    <th
                      scope='col'
                      className='pb-3 font-semibold text-text-secondary hidden sm:table-cell'
                    >
                      {m.admin_payouts_col_created()}
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-border-subtle'>
                  {historyData.payouts.map((payout) => (
                    <tr
                      key={payout.payoutId}
                      className='group transition-colors hover:bg-bg-inset/40'
                    >
                      {/* Creator */}
                      <td className='py-3 pr-4'>
                        <span className='font-medium text-text-primary'>{payout.creatorName}</span>
                      </td>

                      {/* Shop */}
                      <td className='py-3 pr-4'>
                        <Link
                          to='/admin/shops'
                          search={{ filter: 'all' }}
                          className='text-sm text-accent-primary hover:underline'
                        >
                          {payout.shopName}
                        </Link>
                      </td>

                      {/* Amount */}
                      <td className='py-3 pr-4 text-right font-semibold tabular-nums text-text-primary'>
                        {formatPriceEUR(payout.amountCents)}
                      </td>

                      {/* Status */}
                      <td className='py-3 pr-4'>
                        <Badge variant={payout.status === 'sent' ? 'success' : 'warning'}>
                          {payout.status === 'sent'
                            ? m.admin_payouts_status_sent()
                            : m.admin_payouts_status_pending()}
                        </Badge>
                      </td>

                      {/* Sent at */}
                      <td className='py-3 pr-4 hidden md:table-cell text-text-secondary'>
                        {formatDate(payout.sentAt)}
                      </td>

                      {/* Created */}
                      <td className='py-3 pr-4 hidden sm:table-cell text-text-secondary'>
                        {formatDate(payout.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className='flex flex-col items-center gap-3 sm:flex-row sm:justify-between'>
              <div className='flex items-center gap-3'>
                <p className='text-sm text-text-secondary'>
                  {m.admin_payouts_showing({
                    from: showingFrom,
                    to: showingTo,
                    total: historyData.total,
                  })}
                </p>
                <select
                  value={historyData.pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className='h-6 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary'
                  aria-label={m.admin_payouts_page_size_label()}
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              {totalPages > 1 && (
                <nav className='flex items-center gap-4' aria-label={m.admin_payouts_pagination()}>
                  <Button
                    variant='secondary'
                    size='sm'
                    disabled={historyData.page <= 1}
                    onClick={() => handlePageChange(historyData.page - 1)}
                    aria-label={m.pagination_previous()}
                  >
                    <ChevronLeft size={16} aria-hidden='true' />
                    {m.pagination_previous()}
                  </Button>
                  <span className='text-sm text-text-secondary'>
                    {m.pagination_page_of({
                      page: historyData.page,
                      totalPages,
                    })}
                  </span>
                  <Button
                    variant='secondary'
                    size='sm'
                    disabled={historyData.page >= totalPages}
                    onClick={() => handlePageChange(historyData.page + 1)}
                    aria-label={m.pagination_next()}
                  >
                    {m.pagination_next()}
                    <ChevronRight size={16} aria-hidden='true' />
                  </Button>
                </nav>
              )}
            </div>
          </>
        ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                             Loading Skeleton                               */
/* -------------------------------------------------------------------------- */

export function AdminPayoutsPending() {
  return (
    <div className='space-y-6'>
      <div>
        <Skeleton className='mb-2 size-9' />
        <Skeleton className='size-5' />
      </div>

      {/* Tabs skeleton */}
      <Skeleton className='size-10 rounded-lg' />

      {/* Table skeleton */}
      <div className='overflow-x-auto' aria-hidden='true'>
        <table className='w-full text-left text-sm'>
          <thead>
            <tr className='border-b border-border-default'>
              {[1, 2, 3, 4, 5].map((n) => (
                <th key={n} className='pb-3 pr-4'>
                  <Skeleton className='size-4' />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
              <tr key={i} className='border-b border-border-subtle'>
                {[1, 2, 3, 4, 5].map((col) => (
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

export function AdminPayoutsError({ error, reset }: { error: Error; reset?: () => void }) {
  return (
    <div className='text-center py-12'>
      <AlertTriangle size={48} className='mx-auto mb-4 text-error' aria-hidden='true' />
      <h1 className='display-title mb-2 text-2xl font-semibold text-text-primary'>
        {m.admin_payouts_error_load()}
      </h1>
      <p className='mb-6 text-text-secondary'>{error.message}</p>
      {reset && (
        <Button variant='secondary' onClick={reset}>
          {m.admin_payouts_error_retry()}
        </Button>
      )}
    </div>
  )
}
