import { Download, Search, X } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

interface HistoryFiltersProps {
  searchValue: string
  onSearchValueChange: (value: string) => void
  onSearchSubmit: () => void
  onClearSearch: () => void
  dateFrom: string | undefined
  dateTo: string | undefined
  onDateChange: (field: 'from' | 'to', value: string) => void
  hasFilters: boolean
  onClearFilters: () => void
  canExport: boolean
  onExportCSV: () => void
}

export function HistoryFilters({
  searchValue,
  onSearchValueChange,
  onSearchSubmit,
  onClearSearch,
  dateFrom,
  dateTo,
  onDateChange,
  hasFilters,
  onClearFilters,
  canExport,
  onExportCSV,
}: HistoryFiltersProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearchSubmit()
    }
  }

  const handleClear = () => {
    onClearSearch()
    searchInputRef.current?.focus()
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='relative flex-1 min-w-[200px]'>
          <Search
            size={18}
            className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted'
            aria-hidden='true'
          />
          <input
            ref={searchInputRef}
            type='text'
            value={searchValue}
            onChange={(e) => onSearchValueChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={m.admin_payouts_search_placeholder()}
            className='h-10 w-full rounded-lg border border-border-default bg-surface-default pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
            aria-label={m.admin_payouts_search_placeholder()}
          />
          {searchValue && (
            <button
              type='button'
              onClick={handleClear}
              className='absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:text-text-primary transition-colors'
              aria-label={m.admin_orders_clear_search()}
            >
              <X size={16} aria-hidden='true' />
            </button>
          )}
        </div>
        <Button onClick={onSearchSubmit}>{m.admin_common_search()}</Button>
        {canExport && (
          <Button
            variant='secondary'
            onClick={onExportCSV}
            aria-label={m.admin_common_export_csv()}
          >
            <Download size={16} aria-hidden='true' />
            {m.admin_common_export_csv()}
          </Button>
        )}
        {hasFilters && (
          <Button variant='ghost' onClick={onClearFilters}>
            {m.admin_common_clear_filters()}
          </Button>
        )}
      </div>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='flex flex-col gap-1'>
          <label htmlFor='payout-date-from' className='text-xs font-medium text-text-muted'>
            {m.admin_orders_date_from()}
          </label>
          <input
            id='payout-date-from'
            type='date'
            value={dateFrom ?? ''}
            onChange={(e) => onDateChange('from', e.target.value)}
            className='h-9 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
          />
        </div>
        <div className='flex flex-col gap-1'>
          <label htmlFor='payout-date-to' className='text-xs font-medium text-text-muted'>
            {m.admin_orders_date_to()}
          </label>
          <input
            id='payout-date-to'
            type='date'
            value={dateTo ?? ''}
            onChange={(e) => onDateChange('to', e.target.value)}
            className='h-9 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none'
          />
        </div>
      </div>
    </div>
  )
}
