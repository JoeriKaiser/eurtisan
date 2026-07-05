import { useAnalyticsConsent } from '#/hooks/use-analytics-consent'
import { Button } from '#/components/ui/button'
import { Link } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'
import { cn } from '#/lib/cn'
import { useEffect, useState } from 'react'

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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Avoid rendering on the server or before hydration to prevent SSR/client
  // mismatch and to keep the banner from intercepting clicks during hydration.
  if (!mounted || !isRequired || consent !== null) {
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
