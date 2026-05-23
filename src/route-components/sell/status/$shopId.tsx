import { Link } from '@tanstack/react-router'
import { Check, Clock, AlertTriangle, X, Store } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { useLoaderData } from '@tanstack/react-router'

const STATUS_CONFIG: Record<
  string,
  {
    icon: React.ReactNode
    title: string
    description: string
    cta?: { label: string; href: string }
  }
> = {
  pending_review: {
    icon: <Clock size={48} className='text-blue-500' />,
    title: 'Your shop is under review',
    description:
      'We usually review shops within 48 hours. You will be notified once the review is complete.',
  },
  changes_requested: {
    icon: <AlertTriangle size={48} className='text-amber-500' />,
    title: 'Changes requested',
    description: 'Please review the feedback and resubmit your shop.',
    cta: { label: 'Edit & Resubmit', href: '/sell/onboarding/$shopId' },
  },
  approved: {
    icon: <Check size={48} className='text-purple-500' />,
    title: 'Your shop is approved!',
    description: 'Connect payment to go live and start accepting orders.',
    cta: { label: 'Connect Payment', href: '/sell/shops/$shopId/payment' },
  },
  active: {
    icon: <Store size={48} className='text-green-500' />,
    title: 'Your shop is live!',
    description: 'Your shop is now active and visible to buyers.',
    cta: { label: 'View Dashboard', href: '/creator' },
  },
  rejected: {
    icon: <X size={48} className='text-red-500' />,
    title: 'Shop rejected',
    description: 'Your shop did not meet our guidelines. Contact support for more information.',
  },
  suspended: {
    icon: <X size={48} className='text-red-500' />,
    title: 'Shop suspended',
    description: 'Your shop has been suspended. Contact support for assistance.',
  },
}

export function ShopStatusRouteComponent() {
  const { status } = useLoaderData({ from: '/sell/status/$shopId' })
  const config = STATUS_CONFIG[status.status] ?? STATUS_CONFIG.pending_review

  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-lg'>
        <Card>
          <CardContent className='py-12 text-center'>
            <div className='mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-surface-inset'>
              {config.icon}
            </div>
            <h1 className='mb-2 text-2xl font-bold text-text-primary'>{config.title}</h1>
            <p className='mx-auto max-w-sm text-text-secondary'>{config.description}</p>
            {status.moderationNote && (
              <div className='mx-auto mt-4 max-w-sm rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200'>
                <strong>Moderator note:</strong> {status.moderationNote}
              </div>
            )}
            {config.cta && (
              <div className='mt-6'>
                <Link to={config.cta.href} params={{ shopId: status.id }} className='no-underline'>
                  <Button variant='primary'>{config.cta.label}</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
