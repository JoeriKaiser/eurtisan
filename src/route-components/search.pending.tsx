import { useSearch } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'

function DiscoverySkeleton() {
  const patterns = [
    { id: 'feature', className: 'col-span-2 row-span-2' },
    { id: 'small-a', className: 'row-span-1' },
    { id: 'portrait-a', className: 'row-span-2' },
    { id: 'small-b', className: 'row-span-1' },
    { id: 'small-c', className: 'row-span-1' },
    { id: 'landscape', className: 'col-span-2 row-span-1' },
    { id: 'portrait-b', className: 'row-span-2' },
    { id: 'small-d', className: 'row-span-1' },
    { id: 'small-e', className: 'row-span-1' },
  ]

  return (
    <div className='grid auto-rows-[12rem] grid-flow-dense grid-cols-2 gap-2 sm:auto-rows-[15rem] sm:gap-3 md:grid-cols-4 lg:grid-cols-5'>
      {patterns.map((pattern) => (
        <div
          key={pattern.id}
          className={`animate-pulse rounded-2xl bg-surface-inset ${pattern.className}`}
        />
      ))}
      <span className='sr-only'>{m.product_grid_loading()}</span>
    </div>
  )
}

function ProductSkeletons() {
  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3' aria-live='polite'>
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div
          key={`skeleton-${item}`}
          className='island-shell flex flex-col overflow-hidden rounded-2xl'
        >
          <div className='aspect-[4/3] w-full animate-pulse bg-surface-inset' />
          <div className='flex flex-1 flex-col gap-2 p-4'>
            <div className='h-5 w-2/3 animate-pulse rounded bg-surface-inset' />
            <div className='h-4 w-full animate-pulse rounded bg-surface-inset' />
            <div className='mt-4 h-6 w-1/3 animate-pulse rounded bg-surface-inset' />
          </div>
        </div>
      ))}
      <span className='sr-only'>{m.product_grid_loading()}</span>
    </div>
  )
}

export function SearchPending() {
  const search = useSearch({ from: '/search' })
  const isVisualBrowseMode = !search.q

  return (
    <main className='mx-auto w-full max-w-[1320px] px-4 pb-16'>
      <section className='pb-6 pt-8 sm:pb-7 sm:pt-10'>
        <div className='flex items-end justify-between gap-4'>
          <div className='h-11 w-64 animate-pulse rounded-lg bg-surface-inset' />
          <div className='h-11 w-32 animate-pulse rounded-xl bg-surface-inset' />
        </div>
      </section>

      <section className='flex gap-2 overflow-hidden border-y border-border-default py-4'>
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div
            key={`filter-skeleton-${item}`}
            className='h-10 w-28 shrink-0 animate-pulse rounded-full bg-surface-inset'
          />
        ))}
      </section>

      <section className='pt-5'>
        <div className='flex items-center justify-between gap-4'>
          <div className='h-5 w-28 animate-pulse rounded bg-surface-inset' />
          <div className='h-10 w-36 animate-pulse rounded-lg bg-surface-inset' />
        </div>
        <div className='mt-4 h-11 animate-pulse rounded-xl bg-surface-inset' />
        <div className='mt-5'>
          {isVisualBrowseMode ? <DiscoverySkeleton /> : <ProductSkeletons />}
        </div>
      </section>
    </main>
  )
}
