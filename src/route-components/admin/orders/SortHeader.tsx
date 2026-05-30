import { ChevronLeft } from 'lucide-react'

export const SortHeader = ({
  column,
  sortBy,
  sortDir,
  onSort,
  children,
}: {
  column: 'createdAt' | 'totalCents'
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  onSort: (column: 'createdAt' | 'totalCents') => void
  children: React.ReactNode
}) => {
  const isSorted = sortBy === column
  const dir = sortDir ?? 'desc'
  return (
    <button
      type='button'
      onClick={() => onSort(column)}
      className='flex items-center gap-1 font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer'
    >
      {children}
      {isSorted && (
        <span className='text-text-muted'>
          {dir === 'asc' ? (
            <ChevronLeft size={14} className='rotate-90' />
          ) : (
            <ChevronLeft size={14} className='-rotate-90' />
          )}
        </span>
      )}
    </button>
  )
}
