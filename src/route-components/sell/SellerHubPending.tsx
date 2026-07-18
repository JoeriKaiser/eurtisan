import { m } from '#/paraglide/messages'

export function SellerHubPending() {
  return (
    <main className='page-wrap px-4 py-12' aria-busy='true' aria-label={m.seller_hub_loading()}>
      <div className='mx-auto max-w-5xl animate-pulse space-y-8'>
        <div className='space-y-3'>
          <div className='h-8 w-48 rounded bg-surface-inset' />
          <div className='h-5 w-80 max-w-full rounded bg-surface-inset' />
        </div>
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {[1, 2, 3].map((item) => (
            <div key={item} className='h-52 rounded-2xl bg-surface-inset' />
          ))}
        </div>
      </div>
    </main>
  )
}
