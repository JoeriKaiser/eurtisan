import { Skeleton } from '#/components/ui/skeleton'
import { m } from '#/paraglide/messages'

export function DisputeThreadLoading() {
  return (
    <main className='page-wrap px-4 pb-16 pt-14' aria-busy='true'>
      <p className='sr-only' role='status' aria-live='polite'>
        {m.dispute_loading()}
      </p>
      <div className='mx-auto max-w-3xl'>
        <Skeleton className='mb-6 size-4' />
        <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
          <div className='space-y-2'>
            <Skeleton className='size-8' />
            <Skeleton className='size-4' />
          </div>
          <Skeleton className='size-6 rounded-full' />
        </div>
        <div className='space-y-6'>
          <Skeleton className='h-40 w-full' />
          <Skeleton className='h-64 w-full' />
        </div>
      </div>
    </main>
  )
}
