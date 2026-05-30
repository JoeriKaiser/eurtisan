import {
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Shield,
  ShoppingBag,
  Store,
  User,
  Users,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { Card, CardContent } from '#/components/ui/card'
import type { PaginatedAuditLog } from '#/lib/audit-log.server'
import { m } from '#/paraglide/messages'

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDate(date: Date | string): string {
  return DATE_FORMATTER.format(new Date(date))
}

function formatRelativeDate(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return m.time_just_now()
  if (diffMins < 60) return m.time_minutes_ago({ count: diffMins })
  if (diffHours < 24) return m.time_hours_ago({ count: diffHours })
  return m.time_days_ago({ count: diffDays })
}

function actionIcon(action: string) {
  if (action.startsWith('shop.')) return <Store size={16} aria-hidden='true' />
  if (action.startsWith('user.')) return <Users size={16} aria-hidden='true' />
  if (action.startsWith('payout.')) return <FileText size={16} aria-hidden='true' />
  if (action.startsWith('dispute.')) return <Shield size={16} aria-hidden='true' />
  if (action.startsWith('order.')) return <ShoppingBag size={16} aria-hidden='true' />
  if (action.startsWith('category.')) return <FileText size={16} aria-hidden='true' />
  if (action.startsWith('product.')) return <ShoppingBag size={16} aria-hidden='true' />
  return <Clock size={16} aria-hidden='true' />
}

function actionColorClass(action: string): string {
  if (action.includes('.suspend') || action.includes('.ban') || action.includes('.reject')) {
    return 'text-error bg-error/10'
  }
  if (action.includes('.unsuspend') || action.includes('.unban') || action.includes('.approve')) {
    return 'text-success bg-success/10'
  }
  if (action.includes('.resolve') || action.includes('.mark_sent')) {
    return 'text-accent-primary bg-accent-primary/10'
  }
  return 'text-text-muted bg-surface-inset'
}

interface AuditLogTimelineProps {
  entries: PaginatedAuditLog['entries']
}

export function AuditLogTimeline({ entries }: AuditLogTimelineProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  if (entries.length === 0) {
    return (
      <Card variant='elevated'>
        <CardContent className='p-8 text-center'>
          <Clock size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
          <p className='text-text-secondary'>{m.admin_audit_log_empty()}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='space-y-3'>
      {entries.map((entry) => {
        const isExpanded = expandedIds.has(entry.id)
        const hasMetadata = Object.keys(entry.metadata ?? {}).length > 0
        return (
          <div
            key={entry.id}
            className='rounded-xl border border-border-default bg-surface-elevated p-4 transition-colors hover:border-border-subtle'
          >
            <div className='flex items-start gap-4'>
              {/* Action icon */}
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${actionColorClass(entry.action)}`}
              >
                {actionIcon(entry.action)}
              </div>

              {/* Content */}
              <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
                  <span className='text-sm font-semibold text-text-primary'>{entry.action}</span>
                  <span className='text-xs text-text-muted'>
                    {formatRelativeDate(entry.createdAt)}
                  </span>
                </div>

                <div className='mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary'>
                  <span className='inline-flex items-center gap-1'>
                    <User size={12} aria-hidden='true' />
                    {entry.actorName}
                  </span>
                  <span className='inline-flex items-center gap-1'>
                    <FileText size={12} aria-hidden='true' />
                    {entry.resourceType}
                    {entry.resourceId && (
                      <span className='font-mono text-text-muted'>
                        {entry.resourceId.slice(0, 8)}…
                      </span>
                    )}
                  </span>
                  <span className='text-text-muted'>{formatDate(entry.createdAt)}</span>
                </div>

                {/* Expandable metadata */}
                {hasMetadata && (
                  <div className='mt-2'>
                    <button
                      type='button'
                      onClick={() => toggleExpanded(entry.id)}
                      className='inline-flex items-center gap-1 text-xs font-medium text-accent-primary hover:text-accent-primary-hover transition-colors'
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp size={14} aria-hidden='true' />
                          {m.admin_audit_log_collapse()}
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} aria-hidden='true' />
                          {m.admin_audit_log_expand()}
                        </>
                      )}
                    </button>

                    {isExpanded && (
                      <div className='mt-2 rounded-lg border border-border-subtle bg-surface-inset p-3'>
                        <pre className='overflow-x-auto text-xs text-text-secondary font-mono whitespace-pre-wrap'>
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
