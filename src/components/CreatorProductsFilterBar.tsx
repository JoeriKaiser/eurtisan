import { Search } from 'lucide-react'
import { m } from '#/paraglide/messages'
import { Input } from './ui/input'

interface CreatorProductsFilterBarProps {
  searchValue: string
  onSearchChange: (value: string) => void
  active: 'true' | 'false' | 'all'
  onActiveChange: (value: 'true' | 'false' | 'all') => void
  status: 'all' | 'draft' | 'published' | 'archived'
  onStatusChange: (value: 'all' | 'draft' | 'published' | 'archived') => void
}

export function CreatorProductsFilterBar({
  searchValue,
  onSearchChange,
  active,
  onActiveChange,
  status,
  onStatusChange,
}: CreatorProductsFilterBarProps) {
  return (
    <div className='mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
      <div className='relative flex-1 sm:max-w-sm'>
        <Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted' />
        <Input
          type='search'
          placeholder={m.creator_products_search_placeholder()}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className='pl-9'
          aria-label={m.creator_products_search_placeholder()}
        />
      </div>

      <div className='flex flex-wrap items-center gap-3'>
        <div
          className='flex gap-1 rounded-lg border border-border-default bg-surface-inset p-1'
          role='tablist'
          aria-label={m.creator_products_col_status()}
        >
          {(['all', 'draft', 'published', 'archived'] as const).map((value) => {
            const isSelected = status === value
            const label =
              value === 'all'
                ? m.creator_products_filter_all()
                : value === 'draft'
                  ? m.product_status_draft()
                  : value === 'published'
                    ? m.product_status_published()
                    : m.product_status_archived()

            return (
              <button
                key={value}
                type='button'
                role='tab'
                aria-selected={isSelected}
                onClick={() => onStatusChange(value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-surface-default text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div
          className='flex gap-1 rounded-lg border border-border-default bg-surface-inset p-1'
          role='tablist'
          aria-label={m.creator_products_col_status()}
        >
          {(['all', 'true', 'false'] as const).map((value) => {
            const isSelected = active === value
            const label =
              value === 'all'
                ? m.creator_products_filter_all()
                : value === 'true'
                  ? m.creator_products_filter_active()
                  : m.creator_products_filter_inactive()

            return (
              <button
                key={value}
                type='button'
                role='tab'
                aria-selected={isSelected}
                onClick={() => onActiveChange(value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-surface-default text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
