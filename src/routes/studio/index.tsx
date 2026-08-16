import { Link, Navigate, createFileRoute } from '@tanstack/react-router'
import { Store } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { getCreatorShops } from '#/lib/creator-dashboard'
import { guardPrivilegedRole } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/studio/')({
  beforeLoad: async () => guardPrivilegedRole('creator'),
  loader: async () => {
    const shops = await getCreatorShops()
    return { shops }
  },
  component: Studio,
})

function Studio() {
  const { shops } = Route.useLoaderData()
  const firstShop = shops[0]

  if (firstShop) {
    return <Navigate to='/studio/$shopId' params={{ shopId: firstShop.id }} replace />
  }

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell rounded-2xl p-6 sm:p-8'>
        <div className='py-12 text-center'>
          <Store size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
          <h1 className='display-title mb-2 text-2xl font-semibold text-text-primary sm:text-3xl'>
            {m.studio_no_shops_title()}
          </h1>
          <p className='mx-auto max-w-md text-text-secondary'>{m.studio_no_shops_description()}</p>
          <div className='mt-6'>
            <Link to='/sell' className='no-underline'>
              <Button variant='primary'>{m.studio_no_shops_cta()}</Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
