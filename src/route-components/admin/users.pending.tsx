import { Skeleton } from '#/components/ui/skeleton'

export function AdminUsersPending() {
  return (
    <div className='space-y-6'>
      <div>
        <Skeleton className='size-10' />
        <Skeleton className='mt-2 size-5' />
      </div>
      <div className='flex gap-2'>
        <Skeleton className='h-10 flex-1' />
        <Skeleton className='size-10' />
      </div>
      <Skeleton className='h-64 w-full' />
    </div>
  )
}
