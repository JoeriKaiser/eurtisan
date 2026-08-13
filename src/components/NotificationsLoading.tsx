import { Skeleton } from '#/components/ui/skeleton'

export function NotificationsLoading() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <Skeleton className='mb-6 h-8 w-48' />
        <div className='space-y-3' aria-hidden='true'>
          <div className='flex items-start gap-3 rounded-xl border border-border-default p-4'>
            <Skeleton className='size-9 rounded-full' />
            <div className='flex-1 space-y-2'>
              <Skeleton className='h-4 w-3/4' />
              <Skeleton className='h-3 w-24' />
            </div>
          </div>
          <div className='flex items-start gap-3 rounded-xl border border-border-default p-4'>
            <Skeleton className='size-9 rounded-full' />
            <div className='flex-1 space-y-2'>
              <Skeleton className='h-4 w-3/4' />
              <Skeleton className='h-3 w-24' />
            </div>
          </div>
          <div className='flex items-start gap-3 rounded-xl border border-border-default p-4'>
            <Skeleton className='size-9 rounded-full' />
            <div className='flex-1 space-y-2'>
              <Skeleton className='h-4 w-3/4' />
              <Skeleton className='h-3 w-24' />
            </div>
          </div>
          <div className='flex items-start gap-3 rounded-xl border border-border-default p-4'>
            <Skeleton className='size-9 rounded-full' />
            <div className='flex-1 space-y-2'>
              <Skeleton className='h-4 w-3/4' />
              <Skeleton className='h-3 w-24' />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
