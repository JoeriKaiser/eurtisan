import { createFileRoute } from '@tanstack/react-router'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/account/orders')({
  beforeLoad: async () => guardAuth(),
  component: AccountOrders,
})

function AccountOrders() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-4 text-3xl font-bold text-[var(--sea-ink)]'>
          {m.account_orders()}
        </h1>
        <p className='text-[var(--sea-ink-soft)]'>
          Order history placeholder. Your past orders will appear here.
        </p>
      </section>
    </main>
  )
}
