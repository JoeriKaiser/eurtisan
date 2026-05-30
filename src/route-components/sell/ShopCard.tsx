import { Link } from '@tanstack/react-router'
import { Store } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import type { getSellerShops } from '#/lib/sell-onboarding'

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

export function ShopCard({ shop }: { shop: Awaited<ReturnType<typeof getSellerShops>>[number] }) {
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
