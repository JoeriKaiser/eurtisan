import { Search, X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

interface ShopsSearchBarProps {
  searchValue: string
  onSearchValueChange: (value: string) => void
  onSearch: () => void
  onClear: () => void
  searchInputRef: React.RefObject<HTMLInputElement | null>
  onExportCSV: () => void
}

export function ShopsSearchBar({
  searchValue,
  onSearchValueChange,
  onSearch,
  onClear,
  searchInputRef,
  onExportCSV,
}: ShopsSearchBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch()
    }
  }

  return (
    <div className='flex gap-2'>
      <div className='relative flex-1'>
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
          placeholder={m.admin_shops_search_placeholder()}
          className='h-10 w-full rounded-lg border border-border-default bg-surface-default pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
          aria-label={m.admin_shops_search_placeholder()}
        />
        {searchValue && (
          <button
            type='button'
            onClick={onClear}
            className='absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted hover:text-text-primary transition-colors'
            aria-label={m.admin_orders_clear_search()}
          >
            <X size={16} aria-hidden='true' />
          </button>
        )}
      </div>
      <Button onClick={onSearch} aria-label={m.admin_orders_search_button()}>
        {m.admin_orders_search_button()}
      </Button>
      <Button variant='secondary' onClick={onExportCSV} aria-label={m.admin_common_export_csv()}>
        <Search size={16} aria-hidden='true' />
        {m.admin_common_export_csv()}
      </Button>
    </div>
  )
}
