export function ShopOrdersPending() {
  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-5xl'>
        <div className='mb-6 flex items-center justify-between'>
          <div className='size-8 animate-pulse rounded bg-[var(--sand)]' />
          <div className='size-4 animate-pulse rounded bg-[var(--sand)]' />
        </div>
        <div className='mb-6 flex gap-3'>
          <div className='h-10 flex-1 animate-pulse rounded bg-[var(--sand)]' />
          <div className='size-10 animate-pulse rounded bg-[var(--sand)]' />
        </div>
        <div className='space-y-4'>
          {[1, 2, 3].map((n) => (
            <div key={n} className='island-shell h-20 animate-pulse rounded-xl bg-[var(--sand)]' />
          ))}
        </div>
      </div>
    </main>
  )
}
