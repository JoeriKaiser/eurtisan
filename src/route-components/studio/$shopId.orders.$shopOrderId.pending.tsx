export function ShopOrderDetailPending() {
  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-3xl'>
        <div className='mb-6 size-4 animate-pulse rounded bg-[var(--sand)]' />
        <div className='mb-6 flex items-center justify-between'>
          <div className='space-y-2'>
            <div className='size-8 animate-pulse rounded bg-[var(--sand)]' />
            <div className='size-4 animate-pulse rounded bg-[var(--sand)]' />
          </div>
          <div className='size-6 animate-pulse rounded bg-[var(--sand)]' />
        </div>
        <div className='space-y-6'>
          <div className='h-32 animate-pulse rounded-xl bg-[var(--sand)]' />
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='h-32 animate-pulse rounded-xl bg-[var(--sand)]' />
            <div className='h-32 animate-pulse rounded-xl bg-[var(--sand)]' />
          </div>
          <div className='h-40 animate-pulse rounded-xl bg-[var(--sand)]' />
          <div className='h-48 animate-pulse rounded-xl bg-[var(--sand)]' />
        </div>
      </div>
    </main>
  )
}
