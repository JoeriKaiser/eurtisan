import { Link, useLoaderData, useRouter } from '@tanstack/react-router'
import { AlertTriangle, Check, Clock, LockKeyhole, Store, WalletCards, X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'
import { launchApprovedShop } from '#/lib/sell-onboarding'
import { FeedbackBanner } from '#/components/ui/FeedbackBanner'
import { useState } from 'react'

export function ShopStatusRouteComponent() {
  const { status } = useLoaderData({ from: '/sell/status/$shopId' })
  const router = useRouter()
  const [isLaunching, setIsLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)

  const handleLaunch = async () => {
    if (isLaunching) return
    setIsLaunching(true)
    setLaunchError(null)
    try {
      await launchApprovedShop({ data: { shopId: status.id } })
      await router.invalidate()
    } catch {
      setLaunchError(m.onboarding_status_launch_error())
    } finally {
      setIsLaunching(false)
    }
  }
  const configs = {
    pending_review: {
      icon: Clock,
      iconClass: 'text-accent-secondary',
      title: m.onboarding_status_pending_review_title(),
      description: m.onboarding_status_pending_review_desc(),
    },
    changes_requested: {
      icon: AlertTriangle,
      iconClass: 'text-warning',
      title: m.onboarding_status_changes_requested_title(),
      description: m.onboarding_status_changes_requested_desc(),
    },
    approved: {
      icon: Check,
      iconClass: 'text-success',
      title: m.onboarding_status_approved_title(),
      description: m.onboarding_status_approved_desc(),
    },
    active: {
      icon: Store,
      iconClass: 'text-success',
      title: m.onboarding_status_active_title(),
      description: m.onboarding_status_active_desc(),
    },
    rejected: {
      icon: X,
      iconClass: 'text-error',
      title: m.onboarding_status_rejected_title(),
      description: m.onboarding_status_rejected_desc(),
    },
    suspended: {
      icon: X,
      iconClass: 'text-error',
      title: m.onboarding_status_suspended_title(),
      description: m.onboarding_status_suspended_desc(),
    },
  } as const
  const config = configs[status.status as keyof typeof configs] ?? configs.pending_review
  const Icon = config.icon
  const moderationStageLabels = {
    1: m.onboarding_stage_profile(),
    2: m.onboarding_stage_seller(),
    3: m.onboarding_stage_product(),
    4: m.onboarding_stage_delivery(),
  } as const
  const moderationStageLabel = status.moderationStage
    ? moderationStageLabels[status.moderationStage as keyof typeof moderationStageLabels]
    : null

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='mx-auto max-w-2xl rounded-2xl border border-border-default bg-surface-default p-6 sm:p-8'>
        <div className='text-center'>
          <div className='mx-auto flex size-20 items-center justify-center rounded-2xl bg-surface-inset'>
            <Icon size={42} className={config.iconClass} aria-hidden='true' />
          </div>
          <h1 className='display-title mt-5 text-2xl text-text-primary'>{config.title}</h1>
          <p className='mx-auto mt-2 max-w-lg text-text-secondary'>{config.description}</p>
        </div>

        {status.moderationNote && (
          <section
            className='mt-6 rounded-2xl border border-warning/30 bg-warning-subtle p-5 text-left'
            aria-labelledby='moderation-feedback-title'
          >
            <div className='flex items-start gap-3'>
              <AlertTriangle className='mt-0.5 size-5 shrink-0 text-warning' aria-hidden='true' />
              <div className='min-w-0 flex-1'>
                <h2 id='moderation-feedback-title' className='font-semibold text-text-primary'>
                  {m.onboarding_status_review_feedback()}
                </h2>
                {status.status === 'changes_requested' && moderationStageLabel && (
                  <p className='mt-2 text-sm text-text-secondary'>
                    {m.onboarding_status_requested_section()}{' '}
                    <strong className='font-semibold text-text-primary'>
                      {moderationStageLabel}
                    </strong>
                  </p>
                )}
                <p className='mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text-primary'>
                  {status.moderationNote}
                </p>
              </div>
            </div>
          </section>
        )}

        {launchError && (
          <div className='mt-6'>
            <FeedbackBanner type='error' message={launchError} />
          </div>
        )}

        {(status.status === 'approved' || status.status === 'active') && (
          <section className='mt-8' aria-labelledby='launch-checklist-title'>
            <h2 id='launch-checklist-title' className='font-semibold text-text-primary'>
              {m.onboarding_status_launch_checklist()}
            </h2>
            <ul className='mt-3 divide-y divide-border-subtle rounded-xl border border-border-default px-4'>
              <li className='flex min-h-14 items-center gap-3 py-2'>
                {status.twoFactorEnabled ? (
                  <Check className='size-5 text-success' aria-hidden='true' />
                ) : (
                  <LockKeyhole className='size-5 text-warning' aria-hidden='true' />
                )}
                <span className='flex-1 text-sm text-text-primary'>
                  {m.onboarding_status_secure_account()}
                </span>
                {!status.twoFactorEnabled && (
                  <Link
                    to='/account/security'
                    className='inline-flex min-h-11 items-center text-sm font-medium text-accent-primary hover:underline'
                  >
                    {m.onboarding_status_enable_2fa()}
                  </Link>
                )}
              </li>
              <li className='flex min-h-14 items-center gap-3 py-2'>
                {status.paymentConnected ? (
                  <Check className='size-5 text-success' aria-hidden='true' />
                ) : (
                  <WalletCards className='size-5 text-warning' aria-hidden='true' />
                )}
                <span className='flex-1 text-sm text-text-primary'>
                  {m.onboarding_status_connect_payments()}
                </span>
                {status.twoFactorEnabled && !status.paymentConnected && (
                  <Link
                    to='/creator/payouts'
                    search={{ shopId: status.id, status: 'all', page: 1 }}
                    className='inline-flex min-h-11 items-center text-sm font-medium text-accent-primary hover:underline'
                  >
                    {m.onboarding_status_connect_now()}
                  </Link>
                )}
              </li>
              <li className='flex min-h-14 items-center gap-3 py-2'>
                {status.onboardingListingPublished ? (
                  <Check className='size-5 text-success' aria-hidden='true' />
                ) : (
                  <Clock className='size-5 text-text-muted' aria-hidden='true' />
                )}
                <span className='flex-1 text-sm text-text-primary'>
                  {m.onboarding_status_first_product()}
                </span>
                {status.status === 'approved' &&
                  status.twoFactorEnabled &&
                  status.paymentConnected &&
                  !status.onboardingListingPublished && (
                    <Button
                      size='sm'
                      onClick={() => void handleLaunch()}
                      isLoading={isLaunching}
                      disabled={isLaunching}
                    >
                      {m.onboarding_status_go_live()}
                    </Button>
                  )}
              </li>
            </ul>
          </section>
        )}

        <div className='mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center'>
          {status.status === 'changes_requested' && (
            <Link
              to='/sell/onboarding/$draftId'
              params={{ draftId: status.id }}
              className='no-underline'
            >
              <Button className='w-full sm:w-auto'>
                {m.onboarding_status_changes_requested_cta()}
              </Button>
            </Link>
          )}
          {status.status === 'active' && (
            <>
              <Link
                to='/shops/$shopSlug'
                params={{ shopSlug: status.slug }}
                className='no-underline'
              >
                <Button className='w-full sm:w-auto'>{m.onboarding_status_view_live_shop()}</Button>
              </Link>
              <Link to='/creator' search={{ shopId: status.id }} className='no-underline'>
                <Button variant='secondary' className='w-full sm:w-auto'>
                  {m.onboarding_status_active_cta()}
                </Button>
              </Link>
            </>
          )}
          {(status.status === 'rejected' || status.status === 'suspended') && (
            <a href='mailto:support@eurtisan.eu' className='no-underline'>
              <Button className='w-full sm:w-auto'>{m.onboarding_status_contact_support()}</Button>
            </a>
          )}
          <Link to='/sell' className='no-underline'>
            <Button variant='secondary' className='w-full sm:w-auto'>
              {m.onboarding_back_to_hub()}
            </Button>
          </Link>
        </div>
      </section>
    </main>
  )
}
