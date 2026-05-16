import { useNavigate } from '@tanstack/react-router'
import { Skeleton } from '#/components/ui/skeleton'
import type { PublicProduct } from '#/lib/products'
import { m } from '#/paraglide/messages'
import SearchResultCard from './SearchResultCard'

interface SearchResultsPanelProps {
  products: PublicProduct[]
  total: number
  query: string
  isLoading: boolean
  isError: boolean
}

export default function SearchResultsPanel({
  products,
  total,
  query,
  isLoading,
  isError,
}: SearchResultsPanelProps) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className='p-4 sm:p-6'>
        <div className='mb-3 h-4 w-32 animate-pulse rounded bg-surface-inset' />
        <div className='grid gap-2 sm:grid-cols-2'>
          {['skeleton-a', 'skeleton-b', 'skeleton-c', 'skeleton-d', 'skeleton-e', 'skeleton-f'].map(
            (key) => (
              <div
                key={key}
                className='flex items-start gap-3 rounded-xl border border-border-default p-3'
              >
                <Skeleton className='h-16 w-16 shrink-0 rounded-lg' />
                <div className='flex-1 space-y-2'>
                  <Skeleton className='h-4 w-3/4' />
                  <Skeleton className='h-3 w-1/2' />
                  <Skeleton className='h-4 w-16' />
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
        <p>Failed to load results. Please try again.</p>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className='p-4 text-sm text-text-secondary sm:p-6'>
        <p>No products found for &ldquo;{query}&rdquo;</p>
      </div>
    )
  }

  return (
    <div className='p-4 sm:p-6'>
      <div className='mb-3 flex items-center justify-between'>
        <p className='text-xs font-semibold uppercase tracking-wide text-text-muted'>
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
          View all →
        </button>
      </div>
      <div className='grid gap-2 sm:grid-cols-2'>
        {products.map((product) => (
          <SearchResultCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}
