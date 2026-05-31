import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'
import { formatDateMediumTime } from '#/lib/format-date'

interface HistoryPayout {
  payoutId: string
  creatorName: string
  shopName: string
  amountCents: number
  status: string
  sentAt: Date | string | null
  createdAt: Date | string | null
}

interface HistoryData {
  payouts: HistoryPayout[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface HistoryTabProps {
  historyData: HistoryData | null
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

const PAGE_SIZES = [10, 20, 50] as const

function formatDate(date: Date | string | null): string {
  if (!date) return '—'
  return formatDateMediumTime(new Date(date))
}

export function HistoryTab({ historyData, onPageChange, onPageSizeChange }: HistoryTabProps) {
  if (!historyData || historyData.payouts.length === 0) {
    return (
      <div className='py-16 text-center'>
        <Inbox size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
        <h2 className='mb-2 text-lg font-semibold text-text-primary'>
          {m.admin_payouts_history_empty()}
        </h2>
        <p className='text-text-secondary'>{m.admin_payouts_history_empty_desc()}</p>
      </div>
    )
  }

  const { payouts, page, pageSize, total, totalPages } = historyData
  const showingFrom = (page - 1) * pageSize + 1
  const showingTo = Math.min(page * pageSize, total)

  return (
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
              <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary text-right'>
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
            {payouts.map((payout) => (
              <tr key={payout.payoutId} className='group transition-colors hover:bg-bg-inset/40'>
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
    </>
  )
}
