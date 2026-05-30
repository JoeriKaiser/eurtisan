import { Download, Search, X } from 'lucide-react'
import type { RefObject } from 'react'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

interface UsersSearchBarProps {
  searchValue: string
  onSearchValueChange: (value: string) => void
  onSearch: () => void
  onClear: () => void
  searchInputRef: RefObject<HTMLInputElement | null>
  onExportCSV: () => void
}

export function UsersSearchBar({
  searchValue,
  onSearchValueChange,
  onSearch,
  onClear,
  searchInputRef,
  onExportCSV,
}: UsersSearchBarProps) {
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearch()
          }}
          placeholder={m.admin_users_search_placeholder()}
          className='h-10 w-full rounded-lg border border-border-default bg-surface-default pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20'
          aria-label={m.admin_users_search_placeholder()}
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
        <Download size={16} aria-hidden='true' />
        {m.admin_common_export_csv()}
      </Button>
    </div>
  )
}
