import { Skeleton } from '#/components/ui/skeleton'

export function AdminDisputesPending() {
  return (
    <div className='space-y-6'>
      <div>
        <Skeleton className='mb-2 size-9' />
        <Skeleton className='size-5' />
      </div>
      <Skeleton className='size-10 rounded-lg' />
      <Skeleton className='h-10 w-full rounded-lg' />
      <div className='space-y-4'>
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} className='h-20 rounded-xl' />
        ))}
      </div>
    </div>
  )
}
