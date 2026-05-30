import { Store } from 'lucide-react'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { m } from '#/paraglide/messages'

const STATUS_LABELS: Record<string, string> = {
  all: m.admin_shops_filter_all(),
  pending_review: m.admin_shops_filter_pending(),
  changes_requested: m.admin_shops_filter_changes(),
  approved: m.admin_shops_filter_approved(),
  rejected: m.admin_shops_filter_rejected(),
}

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDate(date: Date | string): string {
  return DATE_FORMATTER.format(new Date(date))
}

function isSafeImageUrl(url: string | null): url is string {
  if (!url) return false
  return url.startsWith('/uploads/') || url.startsWith('http://') || url.startsWith('https://')
}

interface ApplicationListItem {
  id: string
  name: string
  slug: string
  image: string | null
  status:
    | 'draft'
    | 'pending_review'
    | 'changes_requested'
    | 'approved'
    | 'active'
    | 'rejected'
    | 'suspended'
  ownerId: string
  ownerName: string | null
  ownerEmail: string | null
  submittedAt: Date | null
  resubmissionCount: number | null
  paymentConnected: boolean | null
  createdAt: Date
}

interface ApplicationsTableProps {
  applications: ApplicationListItem[]
  onReview: (app: ApplicationListItem) => void
}

export function ApplicationsTable({ applications, onReview }: ApplicationsTableProps) {
  if (applications.length === 0) {
    return (
      <Card variant='elevated'>
        <CardContent className='p-8 text-center'>
          <Store size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
          <p className='text-text-secondary'>{m.admin_shops_empty()}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-left text-sm'>
        <thead>
          <tr className='border-b border-border-default'>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_shops_col_name()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_shops_col_owner()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              {m.admin_shops_col_status()}
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              Resubmissions
            </th>
            <th scope='col' className='pb-3 pr-4 font-semibold text-text-secondary'>
              Submitted At
            </th>
            <th scope='col' className='pb-3 text-right font-semibold text-text-secondary'>
              {m.admin_shops_col_actions()}
            </th>
          </tr>
        </thead>
        <tbody className='divide-y divide-border-subtle'>
          {applications.map((app) => (
            <tr key={app.id} className='group hover:bg-bg-inset/40 transition-colors'>
              {/* Name */}
              <td className='py-3 pr-4 font-medium text-text-primary'>
                <div className='flex items-center gap-3'>
                  {app.image && isSafeImageUrl(app.image) ? (
                    <div className='size-6 rounded-full overflow-hidden border border-border-default bg-surface-default flex-shrink-0'>
                      <img src={app.image} alt='' className='h-full w-full object-cover' />
                    </div>
                  ) : (
                    <div className='size-6 rounded-full bg-surface-inset border border-border-subtle flex items-center justify-center text-text-muted flex-shrink-0'>
                      <Store size={14} aria-hidden='true' />
                    </div>
                  )}
                  <div className='flex flex-col min-w-0'>
                    <span className='truncate font-semibold'>{app.name}</span>
                    <span className='font-mono text-xs text-text-muted truncate'>/{app.slug}</span>
                  </div>
                </div>
              </td>

              {/* Creator Owner */}
              <td className='py-3 pr-4 text-text-primary'>
                <div className='flex flex-col min-w-0 max-w-[200px]'>
                  <span className='truncate font-medium'>{app.ownerName}</span>
                  <span className='truncate text-xs text-text-muted'>{app.ownerEmail}</span>
                </div>
              </td>

              {/* Status */}
              <td className='py-3 pr-4'>
                <Badge
                  variant={
                    app.status === 'approved'
                      ? 'success'
                      : app.status === 'pending_review'
                        ? 'warning'
                        : app.status === 'changes_requested'
                          ? 'outline'
                          : 'error'
                  }
                >
                  {STATUS_LABELS[app.status]}
                </Badge>
              </td>

              {/* Resubmissions */}
              <td className='py-3 pr-4 text-text-secondary font-mono'>
                {app.resubmissionCount || 0}
              </td>

              {/* Submitted At */}
              <td className='py-3 pr-4 text-text-secondary font-mono text-xs'>
                {app.submittedAt ? formatDate(app.submittedAt) : '—'}
              </td>

              {/* Actions */}
              <td className='py-3 text-right whitespace-nowrap'>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={() => onReview(app)}
                  aria-label={m.admin_shops_review_details()}
                >
                  {m.admin_shops_review_details()}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
