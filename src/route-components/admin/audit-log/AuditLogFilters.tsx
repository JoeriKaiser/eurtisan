import { User, X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

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
  '',
  'shop.suspend',
  'shop.unsuspend',
  'shop.approve',
  'shop.reject',
  'shop.request_changes',
  'user.change_role',
  'user.ban',
  'user.unban',
  'payout.mark_sent',
  'dispute.resolve',
  'category.create',
  'category.update',
  'category.delete',
  'product.toggle_active',
  'review.moderate',
  'admin.read.user',
  'admin.read.shop',
  'admin.read.order',
  'admin.read.payout',
  'admin.read.product',
  'admin.read.category',
  'admin.read.dispute',
  'admin.read.review',
  'admin.read.audit_log',
  'admin.read.dashboard',
]

interface FiltersState {
  action: string
  actor: string
  resourceType: string
  from: string
  to: string
}

interface AuditLogFiltersProps {
  filters: FiltersState
  onFilterChange: (filters: FiltersState) => void
  onApply: () => void
  onClear: () => void
  hasFilters: boolean
}

export function AuditLogFilters({
  filters,
  onFilterChange,
  onApply,
  onClear,
  hasFilters,
}: AuditLogFiltersProps) {
  return (
    <div className='flex flex-wrap items-end gap-3'>
      <div className='flex flex-col gap-1'>
        <span className='text-xs font-medium text-text-muted'>
          {m.admin_audit_log_filter_action()}
        </span>
        <select
          value={filters.action}
          onChange={(e) => onFilterChange({ ...filters, action: e.target.value })}
          className='h-9 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
        >
          {ACTION_TYPES.map((a) => (
            <option key={a} value={a}>
              {a || m.admin_audit_log_filter_action_all()}
            </option>
          ))}
        </select>
      </div>

      <div className='flex flex-col gap-1'>
        <span className='text-xs font-medium text-text-muted'>
          {m.admin_audit_log_filter_resource_type()}
        </span>
        <select
          value={filters.resourceType}
          onChange={(e) => onFilterChange({ ...filters, resourceType: e.target.value })}
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
            value={filters.actor}
            onChange={(e) => onFilterChange({ ...filters, actor: e.target.value })}
            placeholder={m.admin_audit_log_filter_actor_placeholder()}
            aria-label={m.admin_audit_log_filter_actor()}
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
          value={filters.from}
          onChange={(e) => onFilterChange({ ...filters, from: e.target.value })}
          aria-label={m.admin_audit_log_filter_date_from()}
          className='h-9 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
        />
      </div>

      <div className='flex flex-col gap-1'>
        <span className='text-xs font-medium text-text-muted'>
          {m.admin_audit_log_filter_date_to()}
        </span>
        <input
          type='date'
          value={filters.to}
          onChange={(e) => onFilterChange({ ...filters, to: e.target.value })}
          aria-label={m.admin_audit_log_filter_date_to()}
          className='h-9 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
        />
      </div>

      <Button onClick={onApply}>{m.admin_common_search()}</Button>

      {hasFilters && (
        <Button variant='secondary' onClick={onClear}>
          <X size={14} aria-hidden='true' />
          {m.admin_common_clear_filters()}
        </Button>
      )}
    </div>
  )
}
