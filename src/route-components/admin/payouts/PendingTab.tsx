import { Link } from '@tanstack/react-router'
import { Banknote, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { PayoutStatusBadge } from './HistoryTab'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { formatDateMediumTime } from '#/lib/format-date'

interface PendingPayout {
  payoutId: string
  creatorName: string
  shopName: string
  amountCents: number
  status: string
  failureReason: string | null
  createdAt: Date | string | null
}

interface PendingTabProps {
  payouts: PendingPayout[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  actionPayoutId: string | null
  onMarkSent: (payoutId: string) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

const PAGE_SIZES = [10, 20, 50] as const

function formatDate(date: Date | string | null): string {
  if (!date) return '—'
  return formatDateMediumTime(new Date(date))
}

export function PendingTab({
  payouts,
  page,
  pageSize,
  total,
  totalPages,
  actionPayoutId,
  onMarkSent,
  onPageChange,
  onPageSizeChange,
}: PendingTabProps) {
  if (payouts.length === 0) {
    return (
      <div className='py-16 text-center'>
        <Banknote size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
        <h2 className='mb-2 text-lg font-semibold text-text-primary'>
          {m.admin_payouts_pending_empty()}
        </h2>
        <p className='text-text-secondary'>{m.admin_payouts_pending_empty_desc()}</p>
      </div>
    )
  }

  const showingFrom = (page - 1) * pageSize + 1
  const showingTo = Math.min(page * pageSize, total)

  return (
    <div className='space-y-6'>
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
              <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary text-right'>
                {m.admin_payouts_col_amount()}
              </th>
              <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
                {m.admin_payouts_col_status()}
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
              const isFailed = payout.status === 'failed'

              return (
                <tr key={payout.payoutId} className='group transition-colors hover:bg-bg-inset/40'>
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

                  {/* Status */}
                  <td className='py-3 pr-4'>
                    <div className='flex flex-col gap-0.5'>
                      <PayoutStatusBadge status={payout.status} />
                      {isFailed && payout.failureReason && (
                        <span
                          className='max-w-[200px] truncate text-xs text-text-muted'
                          title={payout.failureReason}
                        >
                          {payout.failureReason}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Created */}
                  <td className='py-3 pr-4 hidden sm:table-cell text-text-secondary'>
                    {formatDate(payout.createdAt)}
                  </td>

                  {/* Actions */}
                  <td className='py-3 text-right'>
                    <Button
                      variant={isFailed ? 'danger' : 'primary'}
                      size='sm'
                      onClick={() => onMarkSent(payout.payoutId)}
                      disabled={isProcessing}
                      isLoading={isProcessing}
                      aria-label={
                        isFailed
                          ? m.admin_payouts_retry_payout_aria({ creator: payout.creatorName })
                          : m.admin_payouts_send_payout_aria({ creator: payout.creatorName })
                      }
                    >
                      {isFailed ? m.admin_payouts_retry_payout() : m.admin_payouts_send_payout()}
                    </Button>
                  </td>
                </tr>
              )
            })}
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
              total,
            })}
          </p>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
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
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label={m.pagination_previous()}
            >
              <ChevronLeft size={16} aria-hidden='true' />
              {m.pagination_previous()}
            </Button>
            <span className='text-sm text-text-secondary'>
              {m.pagination_page_of({
                page,
                totalPages,
              })}
            </span>
            <Button
              variant='secondary'
              size='sm'
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label={m.pagination_next()}
            >
              {m.pagination_next()}
              <ChevronRight size={16} aria-hidden='true' />
            </Button>
          </nav>
        )}
      </div>
    </div>
  )
}
