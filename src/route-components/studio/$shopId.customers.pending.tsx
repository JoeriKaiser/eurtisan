import { Skeleton } from '#/components/ui/skeleton'

export function ShopCustomersPending() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <Skeleton className='mb-4 h-8 w-48' />
        <Skeleton className='mb-8 h-4 w-72' />
        <div className='space-y-3'>
          <Skeleton className='h-12 w-full' />
          <Skeleton className='h-12 w-full' />
          <Skeleton className='h-12 w-full' />
        </div>
      </section>
    </main>
  )
}
