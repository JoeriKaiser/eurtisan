import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus, Store } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { guardAuth } from '#/lib/route-guards'
import { createShopDraft, getSellerShops } from '#/lib/sell-onboarding'
import { m } from '#/paraglide/messages'

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

function CreateShopButton({ shopCount }: { shopCount: number }) {
  const handleCreate = async () => {
    if (shopCount >= 3) {
      const confirmed = window.confirm(
        "You're opening shop #4. Are you sure you want to manage multiple shops?",
      )
      if (!confirmed) return
    }
    const { id } = await createShopDraft()
    window.location.href = `/sell/onboarding/${id}`
  }

  return (
    <Button variant='primary' onClick={handleCreate}>
      <Plus size={16} className='mr-1' />
      Open a New Shop
    </Button>
  )
}

function EmptyShopsState() {
  return (
    <Card>
      <CardContent className='py-12 text-center'>
        <Store size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
        <h2 className='mb-2 text-xl font-semibold text-text-primary'>
          {m.creator_no_shops_title?.() ?? 'No shops yet'}
        </h2>
        <p className='mx-auto max-w-md text-text-secondary'>
          {m.creator_no_shops_description?.() ?? 'Create your first shop to start selling.'}
        </p>
      </CardContent>
    </Card>
  )
}

function ShopCard({ shop }: { shop: Awaited<ReturnType<typeof getSellerShops>>[number] }) {
  const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    pending_review: 'bg-blue-100 text-blue-800',
    changes_requested: 'bg-orange-100 text-orange-800',
    approved: 'bg-purple-100 text-purple-800',
    active: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    suspended: 'bg-gray-100 text-gray-800',
  }

  const statusLabel: Record<string, string> = {
    draft: 'Draft',
    pending_review: 'Pending Review',
    changes_requested: 'Changes Requested',
    approved: 'Approved',
    active: 'Active',
    rejected: 'Rejected',
    suspended: 'Suspended',
  }

  const ctaHref =
    shop.status === 'draft' || shop.status === 'changes_requested'
      ? `/sell/onboarding/${shop.id}`
      : shop.status === 'pending_review' || shop.status === 'approved' || shop.status === 'rejected'
        ? `/sell/status/${shop.id}`
        : `/creator?shopId=${shop.id}`

  const ctaLabel =
    shop.status === 'draft' || shop.status === 'changes_requested'
      ? 'Continue Setup'
      : shop.status === 'pending_review' || shop.status === 'approved' || shop.status === 'rejected'
        ? 'Check Status'
        : 'View Dashboard'

  return (
    <Card className='overflow-hidden'>
      <CardContent className='p-5'>
        <div className='flex items-start gap-3'>
          <div className='flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-inset'>
            {shop.image ? (
              <img src={shop.image} alt='' className='h-full w-full rounded-full object-cover' />
            ) : (
              <Store size={20} className='text-text-muted' />
            )}
          </div>
          <div className='min-w-0 flex-1'>
            <h3 className='truncate font-semibold text-text-primary'>{shop.name}</h3>
            <span
              className={`inline-block mt-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[shop.status] ?? 'bg-gray-100 text-gray-800'}`}
            >
              {statusLabel[shop.status] ?? shop.status}
            </span>
          </div>
        </div>

        <div className='mt-4 flex items-center justify-between text-sm text-text-secondary'>
          <span>{shop.productCount} listings</span>
          <span>Step {shop.onboardingStep}/8</span>
        </div>

        <div className='mt-4'>
          <Link to={ctaHref} className='no-underline'>
            <Button variant='secondary' className='w-full'>
              {ctaLabel}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
