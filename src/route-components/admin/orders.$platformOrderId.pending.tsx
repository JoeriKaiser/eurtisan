import { Skeleton } from '#/components/ui/skeleton'

export function AdminOrderDetailPending() {
  return (
    <div className='pb-16 pt-8'>
      <Skeleton className='mb-6 size-4' />
      <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
        <div className='space-y-2'>
          <Skeleton className='size-8' />
          <Skeleton className='size-4' />
        </div>
        <Skeleton className='size-6 rounded-full' />
      </div>
      <div className='mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <div className='island-shell rounded-xl p-5 space-y-2'>
          <Skeleton className='size-4' />
          <Skeleton className='size-5' />
        </div>
        <div className='island-shell rounded-xl p-5 space-y-2'>
          <Skeleton className='size-4' />
          <Skeleton className='size-5' />
        </div>
      </div>
      <div className='space-y-4'>
        {[1, 2].map((n) => (
          <div key={n} className='island-shell rounded-xl p-5 space-y-4'>
            <Skeleton className='size-6' />
            <Skeleton className='h-16 w-full' />
            <Skeleton className='h-16 w-full' />
          </div>
        ))}
      </div>
    </div>
  )
}
