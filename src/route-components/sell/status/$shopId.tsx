import { Link } from '@tanstack/react-router'
import { Check, Clock, AlertTriangle, X, Store } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { useLoaderData } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'

export function ShopStatusRouteComponent() {
  const { status } = useLoaderData({ from: '/sell/status/$shopId' })

  const STATUS_CONFIG: Record<
    string,
    {
      icon: React.ReactNode
      title: string
      description: string
      cta?: { label: string; href: string; search?: Record<string, string> }
    }
  > = {
    pending_review: {
      icon: <Clock size={48} className='text-blue-500' />,
      title: m.onboarding_status_pending_review_title(),
      description: m.onboarding_status_pending_review_desc(),
    },
    changes_requested: {
      icon: <AlertTriangle size={48} className='text-amber-500' />,
      title: m.onboarding_status_changes_requested_title(),
      description: m.onboarding_status_changes_requested_desc(),
      cta: { label: m.onboarding_status_changes_requested_cta(), href: '/sell/onboarding/$shopId' },
    },
    approved: {
      icon: <Check size={48} className='text-purple-500' />,
      title: m.onboarding_status_approved_title(),
      description: m.onboarding_status_approved_desc(),
      cta: {
        label: m.onboarding_status_approved_cta(),
        href: '/creator/payouts',
        search: { shopId: status.id },
      },
    },
    active: {
      icon: <Store size={48} className='text-green-500' />,
      title: m.onboarding_status_active_title(),
      description: m.onboarding_status_active_desc(),
      cta: { label: m.onboarding_status_active_cta(), href: '/creator' },
    },
    rejected: {
      icon: <X size={48} className='text-red-500' />,
      title: m.onboarding_status_rejected_title(),
      description: m.onboarding_status_rejected_desc(),
    },
    suspended: {
      icon: <X size={48} className='text-red-500' />,
      title: m.onboarding_status_suspended_title(),
      description: m.onboarding_status_suspended_desc(),
    },
  }

  const config = STATUS_CONFIG[status.status] ?? STATUS_CONFIG.pending_review

  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-lg'>
        <Card>
          <CardContent className='py-12 text-center'>
            <div className='mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-surface-inset'>
              {config.icon}
            </div>
            <h1 className='mb-2 text-2xl font-semibold text-text-primary'>{config.title}</h1>
            <p className='mx-auto max-w-sm text-text-secondary'>{config.description}</p>
            {status.moderationNote && (
              <div className='mx-auto mt-4 max-w-sm rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200'>
                <strong>{m.onboarding_status_moderator_note()}</strong> {status.moderationNote}
              </div>
            )}
            {config.cta && (
              <div className='mt-6'>
                <Link
                  to={config.cta.href}
                  params={{ shopId: status.id }}
                  search={config.cta.search}
                  className='no-underline'
                >
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
