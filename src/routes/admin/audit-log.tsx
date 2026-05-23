import { createFileRoute } from '@tanstack/react-router'
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  FileText,
  Inbox,
  Shield,
  ShoppingBag,
  Store,
  User,
  Users,
  X,
} from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import z from 'zod'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { listAuditLog } from '#/lib/audit-log'
import type { AuditLogListItem, PaginatedAuditLog } from '#/lib/audit-log.server'
import { m } from '#/paraglide/messages'

const PAGE_SIZES = [10, 20, 50] as const

/* -------------------------------------------------------------------------- */
/*                              Route Definition                              */
/* -------------------------------------------------------------------------- */

const auditLogSearchSchema = z.object({
  action: z.string().optional().default(''),
  actorId: z.string().optional().default(''),
  resourceType: z.string().optional().default(''),
  from: z.string().optional().default(''),
  to: z.string().optional().default(''),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).optional().default(20),
})

export const Route = createFileRoute('/admin/audit-log')({
  validateSearch: auditLogSearchSchema,
  loaderDeps: ({ search: { action, actorId, resourceType, from, to, page, pageSize } }) => ({
    action,
    actorId,
    resourceType,
    from,
    to,
    page,
    pageSize,
  }),
  loader: async ({ deps }) => {
    return listAuditLog({
      data: {
        action: deps.action || undefined,
        actorId: deps.actorId || undefined,
        resourceType: deps.resourceType || undefined,
        from: deps.from || undefined,
        to: deps.to || undefined,
        page: deps.page,
        pageSize: deps.pageSize,
      },
    })
  },
  head: () => ({ meta: [{ title: 'Audit Log | Admin | Eurtisan' }] }),
  component: AdminAuditLogPage,
  pendingComponent: AdminAuditLogPending,
  errorComponent: AdminAuditLogError,
})

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
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

const RESOURCE_TYPES = [
  { value: '', label: m.admin_audit_log_filter_resource_all() },
  { value: 'shop', label: m.admin_audit_log_resource_shop() },
  { value: 'user', label: m.admin_audit_log_resource_user() },
  { value: 'dispute', label: m.admin_audit_log_resource_dispute() },
  { value: 'payout', label: m.admin_audit_log_resource_payout() },
  { value: 'order', label: m.admin_audit_log_resource_order() },
  { value: 'category', label: m.admin_audit_log_resource_category() },
  { value: 'product', label: m.admin_audit_log_resource_product() },
]

const ACTION_TYPES = [
  { value: '', label: m.admin_audit_log_filter_action_all() },
  { value: 'shop.suspend', label: 'shop.suspend' },
  { value: 'shop.unsuspend', label: 'shop.unsuspend' },
  { value: 'shop.approve', label: 'shop.approve' },
  { value: 'shop.reject', label: 'shop.reject' },
  { value: 'shop.request_changes', label: 'shop.request_changes' },
  { value: 'user.change_role', label: 'user.change_role' },
  { value: 'user.ban', label: 'user.ban' },
  { value: 'user.unban', label: 'user.unban' },
  { value: 'payout.mark_sent', label: 'payout.mark_sent' },
  { value: 'dispute.resolve', label: 'dispute.resolve' },
  { value: 'category.create', label: 'category.create' },
  { value: 'category.update', label: 'category.update' },
  { value: 'category.delete', label: 'category.delete' },
  { value: 'product.toggle_active', label: 'product.toggle_active' },
]

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

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

function AdminAuditLogPage() {
  const loaderData = Route.useLoaderData() as PaginatedAuditLog
  const navigate = Route.useNavigate()
  const search = Route.useSearch()

  const [entries, setEntries] = useState<AuditLogListItem[]>(loaderData.entries)
  const [total, setTotal] = useState(loaderData.total)
  const [page, setPage] = useState(loaderData.page)
  const [pageSize, setPageSize] = useState(loaderData.pageSize)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const [actionFilter, setActionFilter] = useState(search.action ?? '')
  const [actorFilter, setActorFilter] = useState(search.actorId ?? '')
  const [resourceTypeFilter, setResourceTypeFilter] = useState(search.resourceType ?? '')
  const [fromDate, setFromDate] = useState(search.from ?? '')
  const [toDate, setToDate] = useState(search.to ?? '')

  const searchRef = useRef(search)
  searchRef.current = search

  const navigateWithParams = useCallback(
    (overrides: Record<string, string | number | undefined>) => {
      const cleaned: Record<string, string | number> = {}
      for (const [key, value] of Object.entries(overrides)) {
        if (value !== undefined && value !== '') cleaned[key] = value
      }
      navigate({ to: '/admin/audit-log', search: { ...search, ...cleaned }, replace: true })
    },
    [navigate, search],
  )

  const applyFilters = useCallback(() => {
    navigateWithParams({
      action: actionFilter || undefined,
      actorId: actorFilter || undefined,
      resourceType: resourceTypeFilter || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      page: 1,
    })
  }, [actionFilter, actorFilter, resourceTypeFilter, fromDate, toDate, navigateWithParams])

  const clearFilters = useCallback(() => {
    setActionFilter('')
    setActorFilter('')
    setResourceTypeFilter('')
    setFromDate('')
    setToDate('')
    navigateWithParams({
      action: undefined,
      actorId: undefined,
      resourceType: undefined,
      from: undefined,
      to: undefined,
      page: 1,
    })
  }, [navigateWithParams])

  const hasFilters = actionFilter || actorFilter || resourceTypeFilter || fromDate || toDate

  const handlePageChange = useCallback(
    (newPage: number) => {
      navigateWithParams({ page: newPage })
    },
    [navigateWithParams],
  )

  const handlePageSizeChange = useCallback(
    (newPageSize: number) => {
      navigateWithParams({ pageSize: newPageSize, page: 1 })
    },
    [navigateWithParams],
  )

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Sync state when loader data changes (e.g. back/forward nav)
  useMemo(() => {
    setEntries(loaderData.entries)
    setTotal(loaderData.total)
    setPage(loaderData.page)
    setPageSize(loaderData.pageSize)
  }, [loaderData])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='display-title text-3xl font-bold text-text-primary'>
          {m.admin_audit_log_title()}
        </h1>
        <p className='mt-1 text-text-secondary'>{m.admin_audit_log_description()}</p>
      </div>

      {/* Filters */}
      <div className='flex flex-wrap items-end gap-3'>
        <div className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-text-muted'>
            {m.admin_audit_log_filter_action()}
          </span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className='h-9 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
          >
            {ACTION_TYPES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-text-muted'>
            {m.admin_audit_log_filter_resource_type()}
          </span>
          <select
            value={resourceTypeFilter}
            onChange={(e) => setResourceTypeFilter(e.target.value)}
            className='h-9 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
          >
            {RESOURCE_TYPES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-text-muted'>
            {m.admin_audit_log_filter_actor()}
          </span>
          <div className='relative'>
            <User
              size={16}
              className='pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted'
              aria-hidden='true'
            />
            <input
              type='text'
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              placeholder='User ID…'
              className='h-9 w-48 rounded-md border border-border-default bg-surface-default pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none'
            />
          </div>
        </div>

        <div className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-text-muted'>
            {m.admin_audit_log_filter_date_from()}
          </span>
          <input
            type='date'
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className='h-9 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
          />
        </div>

        <div className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-text-muted'>
            {m.admin_audit_log_filter_date_to()}
          </span>
          <input
            type='date'
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className='h-9 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
          />
        </div>

        <Button onClick={applyFilters}>{m.admin_common_search()}</Button>

        {hasFilters && (
          <Button variant='secondary' onClick={clearFilters}>
            <X size={14} aria-hidden='true' />
            {m.admin_common_clear_filters()}
          </Button>
        )}
      </div>

      {/* Timeline */}
      {entries.length === 0 ? (
        <Card variant='elevated'>
          <CardContent className='p-8 text-center'>
            <Inbox size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <p className='text-text-secondary'>{m.admin_audit_log_empty()}</p>
          </CardContent>
        </Card>
      ) : (
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
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${actionColorClass(entry.action)}`}
                  >
                    {actionIcon(entry.action)}
                  </div>

                  {/* Content */}
                  <div className='min-w-0 flex-1'>
                    <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
                      <span className='text-sm font-semibold text-text-primary'>
                        {entry.action}
                      </span>
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
      )}

      {/* Pagination */}
      {entries.length > 0 && (
        <div className='flex flex-col items-center gap-3 sm:flex-row sm:justify-between'>
          <div className='flex items-center gap-3'>
            <p className='text-sm text-text-secondary'>
              {m.admin_shops_showing({
                from: (page - 1) * pageSize + 1,
                to: Math.min(page * pageSize, total),
                total,
              })}
            </p>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className='h-6 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none cursor-pointer'
              aria-label={m.admin_shops_page_size_label()}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          {totalPages > 1 && (
            <nav className='flex items-center gap-4' aria-label={m.admin_shops_pagination()}>
              <Button
                variant='secondary'
                size='sm'
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                aria-label={m.pagination_previous()}
              >
                <ChevronLeft size={16} aria-hidden='true' />
                {m.pagination_previous()}
              </Button>
              <span className='text-sm text-text-secondary font-mono'>
                {m.pagination_page_of({ page, totalPages })}
              </span>
              <Button
                variant='secondary'
                size='sm'
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
                aria-label={m.pagination_next()}
              >
                {m.pagination_next()}
                <ChevronRight size={16} aria-hidden='true' />
              </Button>
            </nav>
          )}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                Pending / Error                             */
/* -------------------------------------------------------------------------- */

export function AdminAuditLogPending() {
  return (
    <div className='space-y-6'>
      <div>
        <Skeleton className='h-10 w-64' />
        <Skeleton className='mt-2 h-5 w-96' />
      </div>
      <div className='flex flex-wrap gap-3'>
        <Skeleton className='h-9 w-32' />
        <Skeleton className='h-9 w-32' />
        <Skeleton className='h-9 w-24' />
        <Skeleton className='h-9 w-32' />
      </div>
      <div className='space-y-3'>
        {[1, 2, 3, 4, 5].map((n) => (
          <Skeleton key={n} className='h-24 w-full rounded-xl' />
        ))}
      </div>
    </div>
  )
}

function AdminAuditLogError({ error }: { error: Error }) {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='display-title text-3xl font-bold text-text-primary'>
          {m.admin_audit_log_title()}
        </h1>
        <p className='mt-1 text-text-secondary'>{m.admin_audit_log_description()}</p>
      </div>
      <div
        role='alert'
        className='island-shell rounded-xl border border-error/30 bg-error-subtle p-4 text-sm text-error'
      >
        <AlertTriangle size={16} className='mr-2 inline-block' aria-hidden='true' />
        {error.message}
      </div>
    </div>
  )
}
