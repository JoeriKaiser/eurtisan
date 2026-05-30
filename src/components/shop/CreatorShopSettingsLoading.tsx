import { Skeleton } from '#/components/ui/skeleton'

export function CreatorShopSettingsLoading() {
  return (
    <main className='page-wrap px-4 py-8 sm:py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <Skeleton className='mb-2 size-9' />
        <Skeleton className='mb-8 size-5' />

        <div className='grid gap-8 lg:grid-cols-3'>
          <div className='space-y-5 lg:col-span-2'>
            <div>
              <Skeleton className='mb-2 size-4' />
              <Skeleton className='h-10 w-full' />
            </div>
            <div>
              <Skeleton className='mb-2 size-4' />
              <Skeleton className='h-10 w-full' />
            </div>
            <div>
              <Skeleton className='mb-2 size-4' />
              <Skeleton className='h-32 w-full' />
            </div>
          </div>
          <div>
            <Skeleton className='mb-2 size-4' />
            <Skeleton className='mb-3 aspect-video w-full rounded-lg' />
            <Skeleton className='h-8 w-full' />
          </div>
        </div>

        <div className='mt-8 border-t border-border-subtle pt-6'>
          <Skeleton className='size-10' />
        </div>
      </section>
    </main>
  )
}
