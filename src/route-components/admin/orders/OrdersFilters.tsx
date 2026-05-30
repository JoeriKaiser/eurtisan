import { Download, Search, X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

const ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'refunded',
  'disputed',
] as const

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

interface OrdersFiltersProps {
  searchValue: string
  onSearchValueChange: (value: string) => void
  onSearchSubmit: () => void
  onClearSearch: () => void
  searchRef: React.RefObject<HTMLInputElement | null>
  dateFrom: string | undefined
  dateTo: string | undefined
  onDateChange: (field: 'from' | 'to', value: string) => void
  statuses: string[] | undefined
  onToggleStatus: (status: string) => void
  hasFilters: boolean
  onClearFilters: () => void
  onExportCSV: () => void
}

export function OrdersFilters({
  searchValue,
  onSearchValueChange,
  onSearchSubmit,
  onClearSearch,
  searchRef,
  dateFrom,
  dateTo,
  onDateChange,
  statuses,
  onToggleStatus,
  hasFilters,
  onClearFilters,
  onExportCSV,
}: OrdersFiltersProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearchSubmit()
    }
  }

  return (
    <div className='flex flex-col gap-4'>
      {/* Search bar */}
      <div className='flex gap-2'>
        <div className='relative flex-1'>
          <Search
            size={18}
            className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted'
            aria-hidden='true'
          />
          <input
            ref={searchRef}
            type='text'
            value={searchValue}
            onChange={(e) => onSearchValueChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={m.admin_orders_search_placeholder()}
            className='h-10 w-full rounded-lg border border-border-default bg-surface-default pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
            aria-label={m.admin_orders_search_placeholder()}
          />
          {searchValue && (
            <button
              type='button'
              onClick={onClearSearch}
              className='absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:text-text-primary transition-colors'
              aria-label={m.admin_orders_clear_search()}
            >
              <X size={16} aria-hidden='true' />
            </button>
          )}
        </div>
        <Button onClick={onSearchSubmit} aria-label={m.admin_orders_search_button()}>
          {m.admin_orders_search_button()}
        </Button>
        <Button variant='secondary' onClick={onExportCSV} aria-label={m.admin_common_export_csv()}>
          <Download size={16} aria-hidden='true' />
          {m.admin_common_export_csv()}
        </Button>
        {hasFilters && (
          <Button variant='ghost' onClick={onClearFilters}>
            {m.admin_common_clear_filters()}
          </Button>
        )}
      </div>

      {/* Date range + status filters */}
      <div className='flex flex-wrap items-end gap-3'>
        <div className='flex flex-col gap-1'>
          <label htmlFor='date-from' className='text-xs font-medium text-text-muted'>
            {m.admin_orders_date_from()}
          </label>
          <input
            id='date-from'
            type='date'
            value={dateFrom ?? ''}
            onChange={(e) => onDateChange('from', e.target.value)}
            className='h-10 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
          />
        </div>
        <div className='flex flex-col gap-1'>
          <label htmlFor='date-to' className='text-xs font-medium text-text-muted'>
            {m.admin_orders_date_to()}
          </label>
          <input
            id='date-to'
            type='date'
            value={dateTo ?? ''}
            onChange={(e) => onDateChange('to', e.target.value)}
            className='h-10 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
          />
        </div>
        <div className='flex flex-col gap-1'>
          <span className='text-xs font-medium text-text-muted'>
            {m.admin_orders_status_filter()}
          </span>
          <div className='flex flex-wrap gap-1'>
            {ORDER_STATUSES.map((status) => {
              const active = statuses?.includes(status)
              return (
                <button
                  key={status}
                  type='button'
                  onClick={() => onToggleStatus(status)}
                  className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                      : 'border-border-default text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {statusLabel(status)}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
