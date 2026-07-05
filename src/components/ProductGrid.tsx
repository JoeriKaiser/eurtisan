import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react'
import type { PublicProduct } from '#/lib/products'
import { m } from '#/paraglide/messages'
import ProductCard from './ProductCard'

export interface ProductGridProps {
  products: PublicProduct[]
  isLoading?: boolean
  emptyMessage?: string
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
}

export default function ProductGrid({
  products,
  isLoading = false,
  emptyMessage,
  page,
  totalPages,
  onPageChange,
}: ProductGridProps) {
  if (isLoading) {
    return (
      <output className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3' aria-live='polite'>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div
            key={`skeleton-${n}`}
            className='island-shell flex flex-col overflow-hidden rounded-2xl'
          >
            <div className='relative aspect-[4/3] w-full animate-pulse bg-gradient-to-br from-surface-inset to-surface-elevated'>
              <ImageOff
                size={32}
                className='absolute inset-0 m-auto text-text-muted/30'
                aria-hidden='true'
              />
            </div>
            <div className='flex flex-1 flex-col gap-2 p-4'>
              <div className='h-5 w-1/3 animate-pulse rounded bg-surface-inset' />
              <div className='h-4 w-full animate-pulse rounded bg-surface-inset' />
              <div className='mt-auto h-6 w-1/3 animate-pulse rounded bg-surface-inset' />
            </div>
          </div>
        ))}
        <span className='sr-only'>{m.product_grid_loading()}</span>
      </output>
    )
  }

  if (products.length === 0) {
    return (
      <p className='py-8 text-center text-sm text-[var(--sea-ink-soft)]'>
        {emptyMessage ?? m.product_grid_empty()}
      </p>
    )
  }

  const showPagination =
    totalPages !== undefined && totalPages > 1 && onPageChange !== undefined && page !== undefined

  return (
    <div className='space-y-6'>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} imageUrl={product.imageUrl ?? null} />
        ))}
      </div>

      {showPagination && (
        <nav aria-label={m.product_pagination()} className='flex items-center justify-center gap-2'>
          <button
            type='button'
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className='inline-flex items-center gap-1 rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed'
            aria-label={m.pagination_previous()}
          >
            <ChevronLeft size={16} aria-hidden='true' />
            <span className='hidden sm:inline'>{m.pagination_previous()}</span>
          </button>

          <span className='text-sm text-[var(--sea-ink-soft)]'>
            {m.pagination_page_of({ page, totalPages })}
          </span>

          <button
            type='button'
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className='inline-flex items-center gap-1 rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed'
            aria-label={m.pagination_next()}
          >
            <span className='hidden sm:inline'>{m.pagination_next()}</span>
            <ChevronRight size={16} aria-hidden='true' />
          </button>
        </nav>
      )}
    </div>
  )
}
