import { cn } from '#/lib/cn'
import type { SuspensionFilter } from '#/lib/shop-moderation'
import { m } from '#/paraglide/messages'

const FILTER_LABELS: Record<SuspensionFilter, string> = {
  all: m.admin_shops_filter_all(),
  active: m.admin_shops_filter_active(),
  suspended: m.admin_shops_filter_suspended(),
}

const STATUS_LABELS: Record<string, string> = {
  all: m.admin_shops_filter_all(),
  pending_review: m.admin_shops_filter_pending(),
  changes_requested: m.admin_shops_filter_changes(),
  approved: m.admin_shops_filter_approved(),
  rejected: m.admin_shops_filter_rejected(),
}

interface FilterPanelProps {
  isModerationView: boolean
  filter: SuspensionFilter | undefined
  status: string | undefined
  onFilterChange: (filter: SuspensionFilter) => void
  onStatusChange: (status: string) => void
}

export function FilterPanel({
  isModerationView,
  filter,
  status,
  onFilterChange,
  onStatusChange,
}: FilterPanelProps) {
  if (isModerationView) {
    return (
      <div
        className='flex gap-1 rounded-lg border border-border-default bg-surface-inset p-1 w-fit'
        role='tablist'
        aria-label={m.admin_shops_filter_label()}
      >
        {(['all', 'active', 'suspended'] as SuspensionFilter[]).map((f) => {
          const isSelected = filter === f
          return (
            <button
              key={f}
              type='button'
              role='tab'
              aria-selected={isSelected}
              onClick={() => onFilterChange(f)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer',
                isSelected
                  ? 'bg-surface-default text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {FILTER_LABELS[f]}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      className='flex flex-wrap gap-1 rounded-lg border border-border-default bg-surface-inset p-1 w-fit'
      role='tablist'
      aria-label={m.admin_shops_filter_label()}
    >
      {['all', 'pending_review', 'changes_requested', 'approved', 'rejected'].map((s) => {
        const isSelected = status === s
        return (
          <button
            key={s}
            type='button'
            role='tab'
            aria-selected={isSelected}
            onClick={() => onStatusChange(s)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer',
              isSelected
                ? 'bg-surface-default text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {STATUS_LABELS[s]}
          </button>
        )
      })}
    </div>
  )
}
