import { Skeleton } from '#/components/ui/skeleton'
import { m } from '#/paraglide/messages'

export function AdminReviewsPending() {
  return (
    <div className='space-y-6' role='status' aria-label={m.admin_reviews_loading()}>
      <span className='sr-only'>{m.admin_reviews_loading()}</span>
      <div className='space-y-2' aria-hidden='true'>
        <Skeleton className='h-9 w-64' />
        <Skeleton className='h-5 w-96 max-w-full' />
      </div>

      <Skeleton className='h-11 w-72 max-w-full rounded-lg' aria-hidden='true' />
      <Skeleton className='h-10 w-96 max-w-full' aria-hidden='true' />

      <div className='overflow-hidden rounded-lg' aria-hidden='true'>
        <div className='grid grid-cols-4 gap-4 border-b border-border-default pb-3'>
          {(['product', 'author', 'content', 'actions'] as const).map((column) => (
            <Skeleton key={column} className='h-4 w-24 max-w-full' />
          ))}
        </div>
        <div className='divide-y divide-border-subtle'>
          {(['one', 'two', 'three', 'four', 'five'] as const).map((row) => (
            <div key={row} className='grid grid-cols-4 gap-4 py-4'>
              {(['product', 'author', 'content', 'actions'] as const).map((column) => (
                <Skeleton key={column} className='h-5 w-full' />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
