import { useNavigate } from '@tanstack/react-router'
import { Skeleton } from '#/components/ui/skeleton'
import type { OverlayProduct } from '#/hooks/useSearchOverlayResults'
import { m } from '#/paraglide/messages'
import SearchResultCard from './SearchResultCard'

interface SearchResultsPanelProps {
  products: OverlayProduct[]
  total: number
  query: string
  isLoading: boolean
  isError: boolean
  /** Called with the 1-based rank of the opened result, for click analytics. */
  onSelectResult?: (product: OverlayProduct, position: number) => void
}

export default function SearchResultsPanel({
  products,
  total,
  query,
  isLoading,
  isError,
  onSelectResult,
}: SearchResultsPanelProps) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className='p-4 sm:p-6'>
        <div className='mb-3 size-4 animate-pulse rounded bg-surface-inset' />
        <div className='grid gap-2 sm:grid-cols-2'>
          {['skeleton-a', 'skeleton-b', 'skeleton-c', 'skeleton-d', 'skeleton-e', 'skeleton-f'].map(
            (key) => (
              <div
                key={key}
                className='flex items-start gap-3 rounded-xl border border-border-default p-3'
              >
                <Skeleton className='size-16 shrink-0 rounded-lg' />
                <div className='flex-1 space-y-2'>
                  <Skeleton className='size-4/4' />
                  <Skeleton className='size-3/2' />
                  <Skeleton className='size-4' />
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className='p-4 text-sm text-text-secondary sm:p-6'>
        <p>{m.search_results_error()}</p>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className='p-4 text-sm text-text-secondary sm:p-6'>
        <p>{m.search_no_products_found({ query })}</p>
      </div>
    )
  }

  return (
    <div className='p-4 sm:p-6'>
      <div className='mb-3 flex items-center justify-between'>
        <p
          className='text-xs font-semibold uppercase tracking-wide text-text-muted'
          aria-live='polite'
        >
          {m.search_results_count({ count: total })}
        </p>
        <button
          type='button'
          onClick={() =>
            navigate({
              to: '/search',
              search: { q: query },
            })
          }
          className='text-xs font-medium text-accent-secondary hover:text-accent-secondary-hover'
        >
          {m.search_view_all()}
        </button>
      </div>
      <div className='grid gap-2 sm:grid-cols-2'>
        {products.map((product, index) => (
          <SearchResultCard
            key={product.id}
            product={product}
            imageUrl={product.imageUrl}
            formattedName={product.formattedName}
            onSelect={() => onSelectResult?.(product, index + 1)}
          />
        ))}
      </div>
    </div>
  )
}
