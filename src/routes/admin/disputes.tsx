import { createFileRoute, Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gavel,
  Hash,
  Inbox,
  User,
} from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { listOpenDisputes } from '#/lib/disputes'
import { guardRole } from '#/lib/route-guards'

const PAGE_SIZE = 20

export const Route = createFileRoute('/admin/disputes')({
  beforeLoad: async () => guardRole('admin'),
  validateSearch: (search: Record<string, unknown>) => ({
    page: Number(search.page) || 1,
  }),
  loaderDeps: ({ search: { page } }) => ({ page }),
  loader: async ({ deps }) => {
    const result = await listOpenDisputes({
      data: { page: deps.page, pageSize: PAGE_SIZE },
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
  if (status === 'open') return { variant: 'warning', label: 'Open' }
  if (status === 'resolved') return { variant: 'success', label: 'Resolved' }
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
  const { disputes, total, page, pageSize } = result
  const totalPages = Math.ceil(total / pageSize)

  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-6xl'>
        {/* Header */}
        <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
          <div className='flex items-center gap-3'>
            <Gavel size={24} className='text-text-secondary' aria-hidden='true' />
            <h1 className='display-title text-2xl font-bold text-text-primary'>Dispute Queue</h1>
            {total > 0 && (
              <span className='text-sm text-text-muted'>
                {total} open dispute{total !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <Link to='/admin' className='text-sm text-text-secondary hover:text-text-primary'>
            Back to dashboard
          </Link>
        </div>

        {/* Empty state */}
        {disputes.length === 0 ? (
          <div className='island-shell rounded-2xl p-8 text-center'>
            <Inbox size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <p className='text-lg font-medium text-text-primary'>No open disputes</p>
            <p className='mt-1 text-sm text-text-secondary'>
              When buyers open disputes, they will appear here.
            </p>
          </div>
        ) : (
          <div className='space-y-4'>
            {/* Desktop table header */}
            <div className='hidden rounded-lg bg-surface-inset px-5 py-2 text-xs font-medium text-text-secondary sm:grid sm:grid-cols-[80px_1fr_1fr_1fr_1fr_80px_100px] sm:gap-4'>
              <span>Age</span>
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
                    search={{ page: page - 1 }}
                    disabled={page <= 1}
                    className='inline-flex items-center gap-1 rounded-lg border border-border-default px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-inset aria-disabled:pointer-events-none aria-disabled:opacity-40'
                    aria-disabled={page <= 1}
                    aria-label='Previous page'
                  >
                    <ChevronLeft size={16} aria-hidden='true' />
                    Previous
                  </Link>
                  <Link
                    to='/admin/disputes'
                    search={{ page: page + 1 }}
                    disabled={page >= totalPages}
                    className='inline-flex items-center gap-1 rounded-lg border border-border-default px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-inset aria-disabled:pointer-events-none aria-disabled:opacity-40'
                    aria-disabled={page >= totalPages}
                    aria-label='Next page'
                  >
                    Next
                    <ChevronRight size={16} aria-hidden='true' />
                  </Link>
                </div>
              </nav>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

/* -------------------------------------------------------------------------- */
/*                             Pending Component                              */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                              Error Component                               */
/* -------------------------------------------------------------------------- */

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
