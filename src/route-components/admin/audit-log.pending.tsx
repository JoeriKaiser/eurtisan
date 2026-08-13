import { Skeleton } from '#/components/ui/skeleton'

export function AdminAuditLogPending() {
  return (
    <div className='space-y-6'>
      <div>
        <Skeleton className='size-10' />
        <Skeleton className='mt-2 size-5' />
      </div>
      <div className='flex flex-wrap gap-3'>
        <Skeleton className='size-9' />
        <Skeleton className='size-9' />
        <Skeleton className='size-9' />
        <Skeleton className='size-9' />
      </div>
      <div className='space-y-3'>
        {[1, 2, 3, 4, 5].map((n) => (
          <Skeleton key={n} className='h-24 w-full rounded-xl' />
        ))}
      </div>
    </div>
  )
}
