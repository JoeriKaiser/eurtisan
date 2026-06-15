import { m } from '#/paraglide/messages'

export function ShopCustomersError({ error }: { error: Error }) {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-2 text-2xl font-semibold text-text-primary'>
          {m.creator_error_load()}
        </h1>
        <p className='text-text-secondary'>{error.message}</p>
      </section>
    </main>
  )
}
