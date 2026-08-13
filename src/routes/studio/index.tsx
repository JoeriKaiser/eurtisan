import { createFileRoute, Navigate } from '@tanstack/react-router'
import { guardPrivilegedRole } from '#/lib/route-guards'
import { getCreatorShops } from '#/lib/creator-dashboard'

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
        <h1 className='display-title mb-4 text-3xl font-semibold text-text-primary'>
          Creator Studio
        </h1>
        <p className='text-text-secondary'>
          You do not have any shops yet. Create one to start selling.
        </p>
      </section>
    </main>
  )
}
