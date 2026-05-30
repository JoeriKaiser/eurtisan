import { m } from '#/paraglide/messages'

export function ShopPending() {
  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <div className='island-shell rounded-2xl px-6 py-10 sm:px-10 sm:py-14'>
        <div className='mb-4 size-4 animate-pulse rounded bg-[var(--sand)]' />
        <div className='mb-4 size-10/3 animate-pulse rounded bg-[var(--sand)]' />
        <div className='size-4/2 animate-pulse rounded bg-[var(--sand)]' />
      </div>
      <div className='mt-8'>
        <output className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3' aria-live='polite'>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={`skeleton-${n}`}
              className='island-shell flex flex-col overflow-hidden rounded-2xl'
            >
              <div className='aspect-[4/3] w-full animate-pulse bg-[var(--sand)]' />
              <div className='flex flex-1 flex-col gap-2 p-4'>
                <div className='size-5/3 animate-pulse rounded bg-[var(--sand)]' />
                <div className='h-4 w-full animate-pulse rounded bg-[var(--sand)]' />
                <div className='mt-auto size-6/3 animate-pulse rounded bg-[var(--sand)]' />
              </div>
            </div>
          ))}
          <span className='sr-only'>{m.product_grid_loading()}</span>
        </output>
      </div>
    </main>
  )
}
