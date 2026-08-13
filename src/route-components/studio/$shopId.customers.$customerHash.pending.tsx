import { Skeleton } from '#/components/ui/skeleton'

export function ShopCustomerDetailPending() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <Skeleton className='mb-4 h-8 w-56' />
        <Skeleton className='mb-8 h-4 w-96' />
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <Skeleton className='h-24 w-full' />
          <Skeleton className='h-24 w-full' />
          <Skeleton className='h-24 w-full' />
          <Skeleton className='h-24 w-full' />
        </div>
      </section>
    </main>
  )
}
