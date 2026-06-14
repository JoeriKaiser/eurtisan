import { useAnalyticsConsent } from '#/hooks/use-analytics-consent'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

export function AnalyticsConsentBanner() {
  const { consent, setConsent, isRequired } = useAnalyticsConsent()

  if (!isRequired || consent !== null) {
    return null
  }

  return (
    <div
      role='dialog'
      aria-live='polite'
      aria-label={m.analytics_consent_title()}
      className='fixed bottom-0 left-0 right-0 z-toast border-t border-border-subtle bg-bg-elevated p-4 shadow-lg'
    >
      <div className='mx-auto flex max-w-7xl flex-col items-center gap-4 sm:flex-row sm:justify-between'>
        <p className='text-sm text-text-secondary'>{m.analytics_consent_description()}</p>
        <div className='flex shrink-0 gap-3'>
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
