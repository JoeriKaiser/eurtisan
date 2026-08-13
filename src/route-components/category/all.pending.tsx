import { m } from '#/paraglide/messages'

export function CategoriesAllPending() {
  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <section className='island-shell rounded-2xl px-6 py-10 sm:px-10 sm:py-14'>
        <div className='mb-4 size-4 animate-pulse rounded bg-[var(--sand)]' />
        <div className='mb-6 h-10 w-1/3 animate-pulse rounded bg-[var(--sand)]' />
        <div className='h-4 w-1/2 animate-pulse rounded bg-[var(--sand)]' />
      </section>
      <div className='mt-8'>
        <output className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3' aria-live='polite'>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={`skeleton-${n}`}
              className='island-shell flex items-center gap-4 rounded-2xl p-5'
            >
              <div className='size-12 animate-pulse rounded-xl bg-[var(--sand)]' />
              <div className='flex-1 space-y-2'>
                <div className='h-5 w-1/3 animate-pulse rounded bg-[var(--sand)]' />
                <div className='h-4 w-1/2 animate-pulse rounded bg-[var(--sand)]' />
              </div>
            </div>
          ))}
          <span className='sr-only'>{m.product_grid_loading()}</span>
        </output>
      </div>
    </main>
  )
}
