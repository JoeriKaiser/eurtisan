import { useLoaderData, useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import type { PaginatedAuditLog } from '#/lib/audit-log.server'
import { m } from '#/paraglide/messages'
import { AuditLogFilters } from './audit-log/AuditLogFilters'
import { AuditLogPagination } from './audit-log/AuditLogPagination'
import { AuditLogTimeline } from './audit-log/AuditLogTimeline'

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */

export function AdminAuditLogPage() {
  const loaderData = useLoaderData({ from: '/admin/audit-log' }) as PaginatedAuditLog
  const navigate = useNavigate()
  const search = useSearch({ from: '/admin/audit-log' })

  const { entries, total, page, pageSize } = loaderData

  const [filters, setFilters] = useState({
    action: search.action ?? '',
    actor: search.actorId ?? '',
    resourceType: search.resourceType ?? '',
    from: search.from ?? '',
    to: search.to ?? '',
  })

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
      action: filters.action || undefined,
      actorId: filters.actor || undefined,
      resourceType: filters.resourceType || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      page: 1,
    })
  }, [filters, navigateWithParams])

  const clearFilters = useCallback(() => {
    setFilters({ action: '', actor: '', resourceType: '', from: '', to: '' })
    navigateWithParams({
      action: undefined,
      actorId: undefined,
      resourceType: undefined,
      from: undefined,
      to: undefined,
      page: 1,
    })
  }, [navigateWithParams])

  const hasFilters = Boolean(
    filters.action || filters.actor || filters.resourceType || filters.from || filters.to,
  )

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

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='display-title text-3xl font-semibold text-text-primary'>
          {m.admin_audit_log_title()}
        </h1>
        <p className='mt-1 text-text-secondary'>{m.admin_audit_log_description()}</p>
      </div>

      <AuditLogFilters
        filters={filters}
        onFilterChange={setFilters}
        onApply={applyFilters}
        onClear={clearFilters}
        hasFilters={hasFilters}
      />

      <AuditLogTimeline entries={entries} />

      {entries.length > 0 && (
        <AuditLogPagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  )
}
