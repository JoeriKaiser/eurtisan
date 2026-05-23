import { createFileRoute, Link } from '@tanstack/react-router'
import { Package, Settings } from 'lucide-react'
import { guardShopOwnership } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/studio/$shopId')({
  beforeLoad: async ({ params }) => guardShopOwnership(params.shopId),
  component: ShopDashboard,
})

function ShopDashboard() {
  const { shopId } = Route.useParams()

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-4 text-3xl font-bold text-text-primary'>
          {m.studio_title()}
        </h1>
        <p className='mb-6 text-text-secondary'>
          Shop dashboard for{' '}
          <code className='rounded bg-neutral-100 px-1 py-0.5 text-sm dark:bg-neutral-800'>
            {shopId}
          </code>
          .
        </p>

        <div className='grid gap-4 sm:grid-cols-2'>
          <Link
            to='/studio/$shopId/orders'
            params={{ shopId }}
            className='island-shell flex items-center gap-4 rounded-xl p-5 transition hover:bg-bg-inset'
          >
            <div className='flex size-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800'>
              <Package size={20} />
            </div>
            <div>
              <h2 className='text-base font-semibold text-text-primary'>Orders</h2>
            </div>
          </Link>

          <Link
            to='/studio/$shopId'
            params={{ shopId }}
            className='island-shell flex items-center gap-4 rounded-xl p-5 transition hover:bg-bg-inset'
          >
            <div className='flex size-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800'>
              <Settings size={20} />
            </div>
            <div>
              <h2 className='text-base font-semibold text-text-primary'>Settings</h2>
            </div>
          </Link>
        </div>
      </section>
    </main>
  )
}
