import { ChevronLeft, ChevronRight } from 'lucide-react'
import { m } from '#/paraglide/messages'
import { Button } from './ui/button'

interface CreatorProductsPaginationProps {
  page: number
  pageSize: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function CreatorProductsPagination({
  page,
  pageSize,
  totalPages,
  total,
  onPageChange,
  onPageSizeChange,
}: CreatorProductsPaginationProps) {
  return (
    <div className='mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between'>
      <p className='text-sm text-text-secondary'>
        {m.creator_products_showing({
          from: (page - 1) * pageSize + 1,
          to: Math.min(page * pageSize, total),
          total,
        })}
      </p>

      <nav className='flex items-center gap-4' aria-label={m.creator_products_pagination()}>
        <div className='flex items-center gap-2'>
          <Button
            variant='secondary'
            size='sm'
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label={m.pagination_previous()}
          >
            <ChevronLeft size={16} aria-hidden='true' />
          </Button>

          <span className='text-sm text-text-secondary'>
            {m.pagination_page_of({
              page,
              totalPages,
            })}
          </span>

          <Button
            variant='secondary'
            size='sm'
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label={m.pagination_next()}
          >
            <ChevronRight size={16} aria-hidden='true' />
          </Button>
        </div>

        <div className='flex items-center gap-2'>
          <label htmlFor='creator-products-page-size' className='text-sm text-text-secondary'>
            {m.creator_products_page_size()}
          </label>
          <select
            id='creator-products-page-size'
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className='h-6 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:border-accent-secondary'
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </nav>
    </div>
  )
}
