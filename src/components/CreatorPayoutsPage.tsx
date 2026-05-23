import { useRouter } from '@tanstack/react-router'
import { AlertTriangle, Banknote, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useState } from 'react'
import type { CreatorPayoutLine } from '#/lib/payouts'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Skeleton } from './ui/skeleton'

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

interface CreatorShop {
  id: string
  name: string
  slug: string
}

interface PaginatedPayouts {
  payouts: CreatorPayoutLine[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/* -------------------------------------------------------------------------- */
/*                                Main Component                              */
/* -------------------------------------------------------------------------- */

export interface CreatorPayoutsPageProps {
  shops: CreatorShop[]
  payouts: PaginatedPayouts
  currentShopId: string | null
  initialStatus: 'all' | 'pending' | 'processing' | 'sent'
}

export function CreatorPayoutsPage({
  shops,
  payouts: initialPayouts,
  currentShopId,
  initialStatus,
}: CreatorPayoutsPageProps) {
  const router = useRouter()

  /* ---- Local filter state ---- */
  const [statusFilter, setStatusFilter] = useState(initialStatus)

  const navigateWithParams = useCallback(
    (overrides: Record<string, string | number | undefined>) => {
      const params: Record<string, string | number> = {
        status: statusFilter,
        ...overrides,
      }

      if (currentShopId) {
        params.shopId = currentShopId
      }

      router.navigate({
        to: '/creator/payouts',
        search: params,
        replace: true,
      })
    },
    [currentShopId, statusFilter, router],
  )

  const handleStatusFilter = useCallback(
    (status: 'all' | 'pending' | 'processing' | 'sent') => {
      setStatusFilter(status)
      router.navigate({
        to: '/creator/payouts',
        search: {
          shopId: currentShopId ?? undefined,
          status,
          page: 1,
        },
        replace: true,
      })
    },
    [currentShopId, router],
  )

  const handlePageChange = useCallback(
    (newPage: number) => {
      navigateWithParams({ page: newPage })
    },
    [navigateWithParams],
  )

  const handleShopChange = useCallback(
    (newShopId: string) => {
      router.navigate({
        to: '/creator/payouts',
        search: { shopId: newShopId, status: statusFilter, page: 1 },
        replace: true,
      })
    },
    [statusFilter, router],
  )

  /* ---- Derived data ---- */
  const payoutsData = initialPayouts.payouts
  const totalEarnedCents = payoutsData
    .filter((p) => !p.isRefund)
    .reduce((sum, p) => sum + p.amountCents, 0)
  const pendingCents = payoutsData
    .filter((p) => p.status === 'pending' && !p.isRefund)
    .reduce((sum, p) => sum + p.amountCents, 0)

  /* ---- No shops ---- */
  if (shops.length === 0) {
    return (
      <main className='page-wrap px-4 py-12'>
        <section className='island-shell rounded-2xl p-6 sm:p-8'>
          <div className='py-12 text-center'>
            <Banknote size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
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
        <h1 className='display-title mb-2 text-3xl font-bold text-text-primary'>
          {m.creator_payouts_title()}
        </h1>
        <p className='mb-6 text-text-secondary'>{m.creator_payouts_description()}</p>

        {/* Shop selector */}
        <div className='mb-6'>
          <label
            htmlFor='creator-payouts-shop'
            className='mb-1.5 block text-sm font-medium text-text-secondary'
          >
            {m.creator_shop_select_label()}
          </label>
          <select
            id='creator-payouts-shop'
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

        {/* Summary Cards */}
        <div className='mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <Card className='transition hover:border-border-strong'>
            <CardHeader className='pb-2'>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-sm font-medium text-text-secondary'>
                  {m.creator_payouts_earned_total()}
                </CardTitle>
                <div className='flex size-6 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary'>
                  <Banknote size={18} aria-hidden='true' />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className='text-2xl font-bold text-text-primary'>
                {formatPriceEUR(totalEarnedCents)}
              </p>
            </CardContent>
          </Card>

          <Card className='transition hover:border-border-strong'>
            <CardHeader className='pb-2'>
              <div className='flex items-center justify-between'>
                <CardTitle className='text-sm font-medium text-text-secondary'>
                  {m.creator_payouts_pending_amount()}
                </CardTitle>
                <div className='flex size-6 items-center justify-center rounded-full bg-warning-subtle text-warning'>
                  <Banknote size={18} aria-hidden='true' />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className='text-2xl font-bold text-text-primary'>{formatPriceEUR(pendingCents)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Status filter tabs */}
        <div className='mb-6'>
          <div
            className='inline-flex gap-1 rounded-lg border border-border-default bg-surface-inset p-1'
            role='tablist'
            aria-label='Filter by payout status'
          >
            {(['all', 'pending', 'processing', 'sent'] as const).map((value) => {
              const isSelected = statusFilter === value
              const label =
                value === 'all'
                  ? m.creator_payouts_filter_all()
                  : value === 'pending'
                    ? m.creator_payouts_filter_pending()
                    : value === 'processing'
                      ? m.creator_payouts_filter_processing()
                      : m.creator_payouts_filter_sent()

              return (
                <button
                  key={value}
                  type='button'
                  role='tab'
                  aria-selected={isSelected}
                  onClick={() => handleStatusFilter(value)}
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
            <thead>
              <tr className='border-b border-border-default'>
                <th className='pb-3 pr-4 font-medium text-text-secondary'>
                  {m.creator_payouts_col_order()}
                </th>
                <th className='pb-3 pr-4 font-medium text-text-secondary'>
                  {m.creator_payouts_col_date()}
                </th>
                <th className='pb-3 pr-4 font-medium text-text-secondary text-right'>
                  {m.creator_payouts_col_amount()}
                </th>
                <th className='pb-3 font-medium text-text-secondary'>
                  {m.creator_payouts_col_status()}
                </th>
              </tr>
            </thead>
            <tbody>
              {payoutsData.map((payout) => {
                const statusLabel =
                  payout.status === 'pending'
                    ? m.creator_payouts_status_pending()
                    : payout.status === 'processing'
                      ? m.creator_payouts_status_processing()
                      : m.creator_payouts_status_sent()

                const statusVariant =
                  payout.status === 'pending'
                    ? 'warning'
                    : payout.status === 'processing'
                      ? 'primary'
                      : 'success'

                return (
                  <tr
                    key={payout.orderId}
                    className='border-b border-border-subtle transition-colors hover:bg-bg-inset'
                  >
                    <td className='py-3 pr-4 font-mono text-xs text-text-primary'>
                      {payout.orderId.substring(0, 8)}…
                    </td>
                    <td className='py-3 pr-4 text-text-primary'>
                      {new Intl.DateTimeFormat(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      }).format(new Date(payout.date))}
                    </td>
                    <td
                      className={`py-3 pr-4 text-right font-medium tabular-nums ${
                        payout.isRefund ? 'text-error' : 'text-text-primary'
                      }`}
                    >
                      {payout.isRefund ? '−' : ''}
                      {formatPriceEUR(Math.abs(payout.amountCents))}
                      {payout.isRefund && (
                        <span className='ml-2'>
                          <Badge variant='error'>{m.creator_payouts_refund_label()}</Badge>
                        </span>
                      )}
                    </td>
                    <td className='py-3'>
                      <Badge variant={statusVariant}>{statusLabel}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {payoutsData.length === 0 && (
          <div className='py-12 text-center'>
            <Banknote size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <h2 className='mb-2 text-lg font-semibold text-text-primary'>
              {statusFilter !== 'all'
                ? m.creator_payouts_no_results()
                : m.creator_payouts_empty_title()}
            </h2>
            <p className='text-text-secondary'>
              {statusFilter !== 'all'
                ? m.creator_payouts_no_results_description()
                : m.creator_payouts_empty_description()}
            </p>
          </div>
        )}

        {/* Pagination */}
        {initialPayouts.totalPages > 1 && (
          <div className='mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between'>
            <p className='text-sm text-text-secondary'>
              {m.creator_payouts_showing({
                from: (initialPayouts.page - 1) * initialPayouts.pageSize + 1,
                to: Math.min(initialPayouts.page * initialPayouts.pageSize, initialPayouts.total),
                total: initialPayouts.total,
              })}
            </p>

            <nav className='flex items-center gap-4' aria-label={m.creator_payouts_pagination()}>
              <div className='flex items-center gap-2'>
                <Button
                  variant='secondary'
                  size='sm'
                  disabled={initialPayouts.page <= 1}
                  onClick={() => handlePageChange(initialPayouts.page - 1)}
                  aria-label={m.pagination_previous()}
                >
                  <ChevronLeft size={16} aria-hidden='true' />
                </Button>

                <span className='text-sm text-text-secondary'>
                  {m.pagination_page_of({
                    page: initialPayouts.page,
                    totalPages: initialPayouts.totalPages,
                  })}
                </span>

                <Button
                  variant='secondary'
                  size='sm'
                  disabled={initialPayouts.page >= initialPayouts.totalPages}
                  onClick={() => handlePageChange(initialPayouts.page + 1)}
                  aria-label={m.pagination_next()}
                >
                  <ChevronRight size={16} aria-hidden='true' />
                </Button>
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

export function CreatorPayoutsLoading() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <Skeleton className='mb-2 h-9 w-48' />
        <Skeleton className='mb-6 h-4 w-72' />

        <Skeleton className='mb-6 h-10 w-full sm:w-64' />

        {/* Summary card skeletons */}
        <div className='mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <Card>
            <CardHeader className='pb-2'>
              <Skeleton className='h-4 w-24' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-8 w-24' />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <Skeleton className='h-4 w-24' />
            </CardHeader>
            <CardContent>
              <Skeleton className='h-8 w-24' />
            </CardContent>
          </Card>
        </div>

        {/* Filter tabs skeleton */}
        <Skeleton className='mb-6 h-10 w-80' />

        {/* Table skeleton */}
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm' aria-hidden='true'>
            <thead>
              <tr className='border-b border-border-default'>
                <th className='pb-3 pr-4'>
                  <Skeleton className='h-4 w-20' />
                </th>
                <th className='pb-3 pr-4'>
                  <Skeleton className='h-4 w-16' />
                </th>
                <th className='pb-3 pr-4'>
                  <Skeleton className='h-4 w-16 ml-auto' />
                </th>
                <th className='pb-3'>
                  <Skeleton className='h-4 w-20' />
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
                <tr key={i} className='border-b border-border-subtle'>
                  <td className='py-3 pr-4'>
                    <Skeleton className='h-4 w-20 font-mono' />
                  </td>
                  <td className='py-3 pr-4'>
                    <Skeleton className='h-4 w-24' />
                  </td>
                  <td className='py-3 pr-4'>
                    <Skeleton className='h-4 w-16 ml-auto' />
                  </td>
                  <td className='py-3'>
                    <Skeleton className='h-5 w-20 rounded-full' />
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

export function CreatorPayoutsError({ error }: { error: Error }) {
  const router = useRouter()

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-6 text-3xl font-bold text-text-primary'>
          {m.creator_payouts_title()}
        </h1>
        <div className='py-12 text-center'>
          <AlertTriangle size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
          <p className='text-text-secondary'>{m.creator_payouts_error_load()}</p>
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
