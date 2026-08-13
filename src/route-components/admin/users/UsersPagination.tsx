import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

const PAGE_SIZES = [10, 20, 50] as const

interface UsersPaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export function UsersPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: UsersPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className='flex flex-col items-center gap-3 sm:flex-row sm:justify-between'>
      <div className='flex items-center gap-3'>
        <p className='text-sm text-text-secondary'>
          {m.admin_shops_showing({
            from: (page - 1) * pageSize + 1,
            to: Math.min(page * pageSize, total),
            total,
          })}
        </p>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className='h-6 rounded-md border border-border-default bg-surface-default px-2 text-sm text-text-primary focus-visible:outline-none cursor-pointer'
          aria-label={m.admin_shops_page_size_label()}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      {totalPages > 1 && (
        <nav className='flex items-center gap-4' aria-label={m.admin_shops_pagination()}>
          <Button
            variant='secondary'
            size='sm'
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label={m.pagination_previous()}
          >
            <ChevronLeft size={16} aria-hidden='true' />
            {m.pagination_previous()}
          </Button>
          <span className='text-sm text-text-secondary font-mono'>
            {m.pagination_page_of({ page, totalPages })}
          </span>
          <Button
            variant='secondary'
            size='sm'
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label={m.pagination_next()}
          >
            {m.pagination_next()}
            <ChevronRight size={16} aria-hidden='true' />
          </Button>
        </nav>
      )}
    </div>
  )
}
