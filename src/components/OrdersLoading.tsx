import { Skeleton } from '#/components/ui/skeleton'
import { m } from '#/paraglide/messages'

export function OrdersLoading() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-6 text-3xl font-semibold text-text-primary'>
          {m.orders_title()}
        </h1>
        <div className='space-y-4' aria-hidden='true'>
          <div className='flex flex-col gap-2 rounded-xl border border-border-default p-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='space-y-2'>
              <Skeleton className='size-4' />
              <Skeleton className='size-3' />
            </div>
            <div className='flex items-center gap-3'>
              <Skeleton className='size-4' />
              <Skeleton className='size-6 rounded-full' />
            </div>
          </div>
          <div className='flex flex-col gap-2 rounded-xl border border-border-default p-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='space-y-2'>
              <Skeleton className='size-4' />
              <Skeleton className='size-3' />
            </div>
            <div className='flex items-center gap-3'>
              <Skeleton className='size-4' />
              <Skeleton className='size-6 rounded-full' />
            </div>
          </div>
          <div className='flex flex-col gap-2 rounded-xl border border-border-default p-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='space-y-2'>
              <Skeleton className='size-4' />
              <Skeleton className='size-3' />
            </div>
            <div className='flex items-center gap-3'>
              <Skeleton className='size-4' />
              <Skeleton className='size-6 rounded-full' />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
