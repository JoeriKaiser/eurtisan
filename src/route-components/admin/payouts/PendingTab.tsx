import { Link } from '@tanstack/react-router'
import { Banknote } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { formatPriceEUR } from '#/lib/pricing'
import { m } from '#/paraglide/messages'

interface PendingPayout {
  payoutId: string
  creatorName: string
  shopName: string
  amountCents: number
  createdAt: Date | string | null
}

interface PendingTabProps {
  payouts: PendingPayout[]
  actionPayoutId: string | null
  onMarkSent: (payoutId: string) => void
}

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDate(date: Date | string | null): string {
  if (!date) return '—'
  return DATE_FORMATTER.format(new Date(date))
}

export function PendingTab({ payouts, actionPayoutId, onMarkSent }: PendingTabProps) {
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

  return (
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

                {/* Created */}
                <td className='py-3 pr-4 hidden sm:table-cell text-text-secondary'>
                  {formatDate(payout.createdAt)}
                </td>

                {/* Actions */}
                <td className='py-3 text-right'>
                  <Button
                    variant='primary'
                    size='sm'
                    onClick={() => onMarkSent(payout.payoutId)}
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
  )
}
