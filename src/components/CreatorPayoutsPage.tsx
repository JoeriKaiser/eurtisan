import { useRouter, Link } from '@tanstack/react-router'
import { AlertTriangle, Banknote, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useState } from 'react'
import { type CreatorPayoutLine, getMollieConnectUrl, disconnectMollie } from '#/lib/payouts'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

interface CreatorShop {
  id: string
  name: string
  slug: string
  paymentConnected?: boolean
  mollieAccountId?: string | null
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

// eslint-disable-next-line
export function CreatorPayoutsPage({
  shops,
  payouts: initialPayouts,
  currentShopId,
  initialStatus,
}: CreatorPayoutsPageProps) {
  const router = useRouter()

  /* ---- Mollie Connect state & actions ---- */
  const activeShop = shops.find((s) => s.id === currentShopId) || shops[0]
  const [connectLoading, setConnectLoading] = useState(false)
  const [disconnectLoading, setDisconnectLoading] = useState(false)
  const [mollieError, setMollieError] = useState<string | null>(null)

  const handleConnectMollie = useCallback(async () => {
    if (!activeShop) return
    try {
      setConnectLoading(true)
      setMollieError(null)
      const res = await getMollieConnectUrl({ data: { shopId: activeShop.id } })
      if (res.url) {
        window.location.href = res.url
      } else {
        throw new Error('No redirection URL returned from the server.')
      }
    } catch (err: any) {
      setMollieError(err?.message || 'Failed to connect with Mollie.')
      setConnectLoading(false)
    }
  }, [activeShop])

  const handleDisconnectMollie = useCallback(async () => {
    if (!activeShop) return
    try {
      setDisconnectLoading(true)
      setMollieError(null)
      await disconnectMollie({ data: { shopId: activeShop.id } })
      await router.invalidate()
    } catch (err: any) {
      setMollieError(err?.message || 'Failed to disconnect Mollie account.')
    } finally {
      setDisconnectLoading(false)
    }
  }, [activeShop, router])

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
        <h1 className='display-title mb-2 text-3xl font-semibold text-text-primary'>
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

        {/* Mollie Connect Integration Card */}
        {activeShop && (
          <div className='mb-6'>
            <Card className='relative overflow-hidden border border-border-default bg-surface-default shadow-sm transition-all duration-300 hover:border-border-strong'>
              <div className='absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-accent-primary to-accent-secondary' />
              <CardHeader className='pb-3 pt-5'>
                <div className='flex items-center justify-between gap-4'>
                  <div className='flex items-center gap-3'>
                    <div className='flex size-10 items-center justify-center rounded-lg bg-surface-inset text-accent-primary'>
                      <Banknote size={20} aria-hidden='true' />
                    </div>
                    <div>
                      <CardTitle className='text-base font-semibold text-text-primary'>
                        {m.creator_payouts_mollie_connect_title()}
                      </CardTitle>
                      <p className='text-xs text-text-muted'>
                        Receive secure payouts in EUR via Mollie Connect
                      </p>
                    </div>
                  </div>
                  {activeShop.paymentConnected ? (
                    <Badge variant='success' className='flex items-center gap-1.5 font-medium'>
                      <span className='size-1.5 rounded-full bg-success' />
                      {m.creator_payouts_mollie_status_connected()}
                    </Badge>
                  ) : (
                    <Badge variant='warning' className='flex items-center gap-1.5 font-medium'>
                      <span className='size-1.5 rounded-full bg-warning animate-pulse' />
                      {m.creator_payouts_mollie_status_disconnected()}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className='pb-5'>
                {mollieError && (
                  <div className='mb-4 flex items-start gap-2 rounded-lg border border-error/20 bg-error/5 p-3 text-sm text-error transition-all'>
                    <AlertTriangle className='size-4 shrink-0 mt-0.5' aria-hidden='true' />
                    <span>{mollieError}</span>
                  </div>
                )}
                <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                  <div className='max-w-xl'>
                    <p className='text-sm text-text-secondary leading-relaxed'>
                      {activeShop.paymentConnected
                        ? m.creator_payouts_mollie_connect_description_connected({
                            merchantId: activeShop.mollieAccountId || '',
                          })
                        : m.creator_payouts_mollie_connect_description_disconnected()}
                    </p>
                  </div>
                  <div className='flex shrink-0 items-center gap-3'>
                    {activeShop.paymentConnected ? (
                      <Button
                        variant='danger'
                        onClick={handleDisconnectMollie}
                        isLoading={disconnectLoading}
                        disabled={connectLoading}
                      >
                        {m.creator_payouts_mollie_disconnect_btn()}
                      </Button>
                    ) : (
                      <Button
                        variant='primary'
                        onClick={handleConnectMollie}
                        isLoading={connectLoading}
                        disabled={disconnectLoading}
                      >
                        {m.creator_payouts_mollie_connect_btn()}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

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
                <th className='pb-3 text-right font-medium text-text-secondary'>Invoices</th>
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
                      {DATE_FORMATTER.format(new Date(payout.date))}
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
                    <td className='py-3 text-right space-x-2'>
                      {!payout.isRefund ? (
                        <>
                          <Link
                            to='/invoices/$invoiceId'
                            params={{ invoiceId: `INV-${payout.orderId.toUpperCase()}` }}
                            className='inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-default px-2.5 py-1 text-xs font-medium text-text-secondary transition hover:text-text-primary hover:border-border-strong print:hidden'
                          >
                            Customer
                          </Link>
                          <Link
                            to='/invoices/$invoiceId'
                            params={{ invoiceId: `INV-FEE-${payout.orderId.toUpperCase()}` }}
                            className='inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-default px-2.5 py-1 text-xs font-medium text-text-secondary transition hover:text-text-primary hover:border-border-strong print:hidden'
                          >
                            Platform Fee
                          </Link>
                        </>
                      ) : (
                        <span className='text-xs text-text-muted font-medium'>-</span>
                      )}
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
