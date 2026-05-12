import { createFileRoute, Link } from '@tanstack/react-router'
import { AlertTriangle, Clock, Gavel, Inbox } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { listOpenDisputes } from '#/lib/disputes'
import { formatPriceEUR } from '#/lib/pricing'
import { guardRole } from '#/lib/route-guards'

export const Route = createFileRoute('/admin/disputes')({
  beforeLoad: async () => guardRole('admin'),
  loader: async () => {
    const disputes = await listOpenDisputes()
    return { disputes }
  },
  head: () => ({
    meta: [{ title: 'Disputes | Admin' }],
  }),
  component: AdminDisputesPage,
  pendingComponent: AdminDisputesPending,
  errorComponent: AdminDisputesError,
})

function getReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    item_not_received: 'Item not received',
    not_as_described: 'Not as described',
    damaged: 'Damaged',
    other: 'Other',
  }
  return labels[reason] ?? reason
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

export function AdminDisputesPage() {
  const { disputes } = Route.useLoaderData()

  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-6xl'>
        <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
          <div className='flex items-center gap-3'>
            <Gavel size={24} className='text-text-secondary' aria-hidden='true' />
            <h1 className='display-title text-2xl font-bold text-text-primary'>Dispute Queue</h1>
          </div>
          <Link to='/admin' className='text-sm text-text-secondary hover:text-text-primary'>
            Back to dashboard
          </Link>
        </div>

        {disputes.length === 0 ? (
          <div className='island-shell rounded-2xl p-8 text-center'>
            <Inbox size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <p className='text-text-secondary'>No open disputes.</p>
          </div>
        ) : (
          <div className='space-y-4'>
            {/* Desktop table header */}
            <div className='hidden rounded-lg bg-surface-inset px-5 py-2 text-xs font-medium text-text-secondary sm:grid sm:grid-cols-[80px_1fr_1fr_1fr_120px_100px] sm:gap-4'>
              <span>Age</span>
              <span>Reason</span>
              <span>Buyer</span>
              <span>Shop</span>
              <span>Order</span>
              <span className='text-right'>Total</span>
            </div>

            {disputes.map((dispute) => (
              <Link
                key={dispute.id}
                to='/admin/disputes/$disputeId'
                params={{ disputeId: dispute.id }}
                className='island-shell flex flex-col gap-3 rounded-xl p-5 transition hover:bg-bg-inset sm:grid sm:grid-cols-[80px_1fr_1fr_1fr_120px_100px] sm:items-center sm:gap-4'
              >
                <div className='flex items-center gap-2'>
                  <Clock size={14} className='text-text-muted' aria-hidden='true' />
                  <span className='font-mono text-sm text-text-secondary'>
                    {getDisputeAge(dispute.createdAt)}
                  </span>
                </div>
                <div>
                  <Badge variant='warning'>{getReasonLabel(dispute.reason)}</Badge>
                </div>
                <div>
                  <p className='text-sm text-text-primary'>{dispute.buyerName}</p>
                </div>
                <div>
                  <p className='text-sm text-text-primary'>{dispute.shopName}</p>
                </div>
                <div>
                  <span className='font-mono text-sm text-text-secondary'>
                    {dispute.shopOrderId.slice(0, 8)}…
                  </span>
                </div>
                <div className='text-left sm:text-right'>
                  <p className='text-base font-semibold text-text-primary'>
                    {formatPriceEUR(dispute.orderTotalCents)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function AdminDisputesPending() {
  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-6xl'>
        <div className='mb-6 flex items-center justify-between'>
          <div className='h-8 w-48 animate-pulse rounded bg-[var(--sand)]' />
          <div className='h-4 w-24 animate-pulse rounded bg-[var(--sand)]' />
        </div>
        <div className='space-y-4'>
          {[1, 2, 3].map((n) => (
            <div key={n} className='island-shell h-20 animate-pulse rounded-xl bg-[var(--sand)]' />
          ))}
        </div>
      </div>
    </main>
  )
}

function AdminDisputesError({ error }: { error: Error }) {
  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-6xl text-center'>
        <AlertTriangle size={48} className='mx-auto mb-4 text-error' aria-hidden='true' />
        <h1 className='display-title mb-4 text-2xl font-bold text-text-primary'>
          Failed to load disputes
        </h1>
        <p className='mb-6 text-text-secondary'>{error.message}</p>
      </div>
    </main>
  )
}
