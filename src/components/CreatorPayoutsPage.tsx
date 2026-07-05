import { useRouter, Link } from '@tanstack/react-router'
import { AlertTriangle, Banknote, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useState } from 'react'
import { type CreatorPayoutLine, getMollieConnectUrl, disconnectMollie } from '#/lib/payouts'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { SUPPORTED_CURRENCY } from '#/lib/currency'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { formatDateShort } from '#/lib/format-date'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from './ui/primitives/dialog'

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
  initialStatus: 'all' | 'pending' | 'in_transit' | 'sent' | 'failed' | 'reversed'
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
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false)

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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect with Mollie.'
      setMollieError(message)
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect Mollie account.'
      setMollieError(message)
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
    (status: CreatorPayoutsPageProps['initialStatus']) => {
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
                        {m.creator_payouts_mollie_subtitle({ currency: SUPPORTED_CURRENCY })}
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
                        variant='secondary'
                        onClick={() => setShowDisconnectDialog(true)}
                        disabled={connectLoading || disconnectLoading}
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
            {(['all', 'pending', 'in_transit', 'sent', 'failed', 'reversed'] as const).map(
              (value) => {
                const isSelected = statusFilter === value
                const labelMap: Record<typeof value, () => string> = {
                  all: () => m.creator_payouts_filter_all(),
                  pending: () => m.creator_payouts_filter_pending(),
                  in_transit: () => m.creator_payouts_filter_in_transit(),
                  sent: () => m.creator_payouts_filter_sent(),
                  failed: () => m.creator_payouts_filter_failed(),
                  reversed: () => m.creator_payouts_filter_reversed(),
                }
                const label = labelMap[value]()

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
              },
            )}
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
                <th className='pb-3 text-right font-medium text-text-secondary'>
                  {m.creator_payouts_invoices_col()}
                </th>
              </tr>
            </thead>
            <tbody>
              {payoutsData.map((payout) => {
                const statusLabelMap: Record<CreatorPayoutLine['status'], () => string> = {
                  pending: () => m.creator_payouts_status_pending(),
                  in_transit: () => m.creator_payouts_status_in_transit(),
                  sent: () => m.creator_payouts_status_sent(),
                  failed: () => m.creator_payouts_status_failed(),
                  reversed: () => m.creator_payouts_status_reversed(),
                  returned: () => m.creator_payouts_status_returned(),
                }
                const statusLabel = statusLabelMap[payout.status]()

                const statusVariantMap: Record<
                  CreatorPayoutLine['status'],
                  'warning' | 'primary' | 'success' | 'error' | 'secondary'
                > = {
                  pending: 'warning',
                  in_transit: 'primary',
                  sent: 'success',
                  failed: 'error',
                  reversed: 'secondary',
                  returned: 'secondary',
                }
                const statusVariant = statusVariantMap[payout.status]

                return (
                  <tr
                    key={payout.orderId}
                    className='border-b border-border-subtle transition-colors hover:bg-bg-inset'
                  >
                    <td className='py-3 pr-4 font-mono text-xs text-text-primary'>
                      {payout.orderId.substring(0, 8)}…
                    </td>
                    <td className='py-3 pr-4 text-text-primary'>
                      {formatDateShort(new Date(payout.date))}
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
                          {payout.customerInvoiceNumber ? (
                            <Link
                              to='/invoices/$invoiceId'
                              params={{ invoiceId: payout.customerInvoiceNumber }}
                              className='inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-default px-2.5 py-1 text-xs font-medium text-text-secondary transition hover:text-text-primary hover:border-border-strong print:hidden'
                            >
                              {m.creator_payouts_invoice_customer()}
                            </Link>
                          ) : null}
                          {payout.platformFeeInvoiceNumber ? (
                            <Link
                              to='/invoices/$invoiceId'
                              params={{ invoiceId: payout.platformFeeInvoiceNumber }}
                              className='inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-default px-2.5 py-1 text-xs font-medium text-text-secondary transition hover:text-text-primary hover:border-border-strong print:hidden'
                            >
                              {m.creator_payouts_invoice_platform_fee()}
                            </Link>
                          ) : null}
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

      <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup>
            <div className='flex items-start gap-3'>
              <div className='flex size-9 shrink-0 items-center justify-center rounded-full bg-error-subtle text-error'>
                <AlertTriangle size={18} aria-hidden='true' />
              </div>
              <div>
                <DialogTitle>{m.creator_payouts_disconnect_confirm_title()}</DialogTitle>
                <DialogDescription className='mt-1'>
                  {m.creator_payouts_disconnect_confirm_description({
                    shopName: activeShop?.name ?? '',
                  })}
                </DialogDescription>
              </div>
            </div>
            <div className='mt-6 flex justify-end gap-3'>
              <Button
                type='button'
                variant='secondary'
                onClick={() => setShowDisconnectDialog(false)}
                disabled={disconnectLoading}
              >
                {m.creator_payouts_disconnect_cancel()}
              </Button>
              <Button
                type='button'
                variant='danger'
                onClick={() => {
                  setShowDisconnectDialog(false)
                  void handleDisconnectMollie()
                }}
                isLoading={disconnectLoading}
                disabled={disconnectLoading}
              >
                {m.creator_payouts_disconnect_confirm()}
              </Button>
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </main>
  )
}
