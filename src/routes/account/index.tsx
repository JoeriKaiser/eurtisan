import { createFileRoute, Link } from '@tanstack/react-router'
import { Package, Settings } from 'lucide-react'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/account/')({
  beforeLoad: async () => guardAuth(),
  component: Account,
})

function Account() {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-6 text-3xl font-bold text-text-primary'>
          {m.account_title()}
        </h1>

        <div className='grid gap-4 sm:grid-cols-2'>
          <Link
            to='/account/orders'
            className='island-shell flex items-center gap-4 rounded-xl p-5 transition hover:bg-bg-inset'
          >
            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800'>
              <Package size={20} />
            </div>
            <div>
              <h2 className='text-base font-semibold text-text-primary'>{m.account_orders()}</h2>
            </div>
          </Link>

          <Link
            to='/account/settings'
            className='island-shell flex items-center gap-4 rounded-xl p-5 transition hover:bg-bg-inset'
          >
            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800'>
              <Settings size={20} />
            </div>
            <div>
              <h2 className='text-base font-semibold text-text-primary'>{m.account_settings()}</h2>
            </div>
          </Link>
        </div>
      </section>
    </main>
  )
}
