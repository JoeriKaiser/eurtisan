import { createFileRoute } from '@tanstack/react-router'
import { guardAuth } from '#/lib/route-guards'
import { getSellerShops } from '#/lib/sell-onboarding'
import { CreateShopButton } from '#/route-components/sell/CreateShopButton'
import { EmptyShopsState } from '#/route-components/sell/EmptyShopsState'
import { ShopCard } from '#/route-components/sell/ShopCard'

export const Route = createFileRoute('/sell/')({
  beforeLoad: async () => guardAuth(),
  loader: async () => {
    const shops = await getSellerShops()
    return { shops }
  },
  head: () => ({
    meta: [{ title: `Seller Hub | Eurtisan` }],
  }),
  component: SellerHubRouteComponent,
})

function SellerHubRouteComponent() {
  const { shops } = Route.useLoaderData()

  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-5xl'>
        <div className='mb-8 flex items-center justify-between'>
          <div>
            <h1 className='display-title text-3xl font-semibold text-text-primary'>Seller Hub</h1>
            <p className='mt-1 text-text-secondary'>Manage your shops and create new ones.</p>
          </div>
          <CreateShopButton shopCount={shops.length} />
        </div>

        {shops.length === 0 ? (
          <EmptyShopsState />
        ) : (
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {shops.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
