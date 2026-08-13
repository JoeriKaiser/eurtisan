import { useAnalyticsConsent } from '#/hooks/use-analytics-consent'
import { Button } from '#/components/ui/button'
import { Link, useHydrated } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'
import { cn } from '#/lib/cn'

interface AnalyticsConsentBannerProps {
  /**
   * Layout mode. `fixed` keeps the banner anchored to the viewport bottom-right
   * for non-auth pages. `relative` renders it as a block so auth shells can place
   * it inside their card layout without overlapping CTAs.
   */
  position?: 'fixed' | 'relative'
}

export function AnalyticsConsentBanner({ position = 'fixed' }: AnalyticsConsentBannerProps) {
  const { consent, setConsent, isRequired } = useAnalyticsConsent()
  const hydrated = useHydrated()

  // Keep SSR and the hydration render identical while local consent is unavailable.
  if (!hydrated || !isRequired || consent !== null) {
    return null
  }

  return (
    <div
      role='dialog'
      aria-live='polite'
      aria-label={m.analytics_consent_title()}
      className={cn(
        'z-toast border border-border-subtle bg-bg-elevated p-5 rounded-xl shadow-xl',
        position === 'fixed'
          ? 'fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md'
          : 'relative w-full mt-6',
      )}
    >
      <div className='flex flex-col gap-4'>
        <p className='text-sm text-text-secondary leading-relaxed'>
          {m.analytics_consent_description()}{' '}
          <Link
            to='/privacy'
            className='underline hover:text-text-primary transition-colors font-medium'
          >
            {m.analytics_consent_learn_more()}
          </Link>
        </p>
        <div className='flex justify-end gap-3'>
          <Button type='button' variant='secondary' size='sm' onClick={() => setConsent('denied')}>
            {m.analytics_consent_decline()}
          </Button>
          <Button type='button' size='sm' onClick={() => setConsent('granted')}>
            {m.analytics_consent_accept()}
          </Button>
        </div>
      </div>
    </div>
  )
}
