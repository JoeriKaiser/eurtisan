import ShopPage from '#/components/ShopPage'
import { m } from '#/paraglide/messages'
import { useLoaderData } from '@tanstack/react-router'

export function ShopRouteComponent() {
  const { shop, products, searchQuery } = useLoaderData({ from: '/shops/$shopSlug' })
  return <ShopPage shop={shop} products={products} searchQuery={searchQuery} />
}

export function ShopError({ error }: { error: Error }) {
  return (
    <main className='page-wrap px-4 py-20 text-center'>
      <h1 className='display-title mb-4 text-3xl font-bold text-text-primary'>
        {m.error_unexpected()}
      </h1>
      <p className='mb-6 text-text-secondary'>{error.message}</p>
    </main>
  )
}

export function ShopPending() {
  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <div className='island-shell rounded-2xl px-6 py-10 sm:px-10 sm:py-14'>
        <div className='mb-4 h-4 w-20 animate-pulse rounded bg-[var(--sand)]' />
        <div className='mb-4 h-10 w-2/3 animate-pulse rounded bg-[var(--sand)]' />
        <div className='h-4 w-1/2 animate-pulse rounded bg-[var(--sand)]' />
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
                <div className='h-5 w-2/3 animate-pulse rounded bg-[var(--sand)]' />
                <div className='h-4 w-full animate-pulse rounded bg-[var(--sand)]' />
                <div className='mt-auto h-6 w-1/3 animate-pulse rounded bg-[var(--sand)]' />
              </div>
            </div>
          ))}
          <span className='sr-only'>{m.product_grid_loading()}</span>
        </output>
      </div>
    </main>
  )
}
