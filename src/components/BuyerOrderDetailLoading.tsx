import { Skeleton } from '#/components/ui/skeleton'

export function BuyerOrderDetailLoading() {
  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <div className='mx-auto max-w-3xl'>
        <Skeleton className='mb-6 size-4' />
        <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
          <div className='space-y-2'>
            <Skeleton className='size-8' />
            <Skeleton className='size-4' />
          </div>
          <Skeleton className='size-6 rounded-full' />
        </div>
        <div className='island-shell rounded-2xl p-6 space-y-6'>
          <Skeleton className='h-20 w-full' />
          <Skeleton className='h-40 w-full' />
          <Skeleton className='h-40 w-full' />
        </div>
      </div>
    </main>
  )
}
