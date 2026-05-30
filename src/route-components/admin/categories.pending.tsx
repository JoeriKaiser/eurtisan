import { Skeleton } from '#/components/ui/skeleton'

export function AdminCategoriesPending() {
  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <Skeleton className='size-10' />
          <Skeleton className='mt-2 size-5' />
        </div>
        <Skeleton className='size-10' />
      </div>
      <Skeleton className='h-64 w-full' />
    </div>
  )
}
