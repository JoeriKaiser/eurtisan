import { createFileRoute } from '@tanstack/react-router'
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
        <p className='text-text-secondary'>
          Shop dashboard for{' '}
          <code className='rounded bg-neutral-100 px-1 py-0.5 text-sm dark:bg-neutral-800'>
            {shopId}
          </code>
          .
        </p>
      </section>
    </main>
  )
}
