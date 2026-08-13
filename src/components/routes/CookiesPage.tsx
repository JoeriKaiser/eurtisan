import { useState } from 'react'
import LegalPageLayout from '#/components/LegalPageLayout'
import { m } from '#/paraglide/messages'
import { Button } from '#/components/ui/button'
import { Check, Cookie, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react'
import { useAnalyticsConsent } from '#/hooks/use-analytics-consent'
import type { PublicOperatorProfile } from '#/lib/legal/operator'

const LAST_UPDATED = '13 July 2026'

export interface CookiesPageProps {
  operator?: PublicOperatorProfile
}

function CookieToggle({
  title,
  description,
  checked,
  onChange,
  disabled,
  icon,
}: {
  title: string
  description: string
  checked: boolean
  onChange?: () => void
  disabled?: boolean
  icon: React.ReactNode
}) {
  const Icon = checked ? ToggleRight : ToggleLeft

  return (
    <div
      className={`flex items-start gap-4 rounded-xl border p-4 ${
        disabled
          ? 'border-border-subtle bg-surface-inset'
          : 'border-border-default bg-surface-default'
      }`}
    >
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
          disabled
            ? 'bg-surface-inset text-text-muted'
            : 'bg-accent-primary-subtle text-accent-primary'
        }`}
      >
        {icon}
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex items-center justify-between gap-3'>
          <h3 className='font-semibold text-text-primary'>{title}</h3>
          <button
            type='button'
            role='switch'
            aria-checked={checked}
            disabled={disabled}
            onClick={onChange}
            className={`shrink-0 transition-opacity ${
              disabled ? 'cursor-not-allowed opacity-50' : 'hover:opacity-80'
            }`}
          >
            <Icon size={28} className={checked ? 'text-accent-primary' : 'text-text-muted'} />
            <span className='sr-only'>{checked ? 'Enabled' : 'Disabled'}</span>
          </button>
        </div>
        <p className='mt-1 text-sm text-text-secondary'>{description}</p>
      </div>
    </div>
  )
}

export default function CookiesPage({ operator }: CookiesPageProps = {}) {
  const { consent, setConsent, isRequired } = useAnalyticsConsent()
  const [pendingConsent, setPendingConsent] = useState<'granted' | 'denied' | null>(consent)
  const [saved, setSaved] = useState(false)

  const contactEmail = operator?.email || m.legal_contact_email()
  const sections = [
    { title: m.cookies_section_1_title(), text: m.cookies_section_1_text() },
    { title: m.cookies_section_2_title(), text: m.cookies_section_2_text() },
    { title: m.cookies_section_3_title(), text: m.cookies_section_3_text() },
    { title: m.cookies_section_4_title(), text: m.cookies_section_4_text() },
    { title: m.cookies_section_5_title(), text: m.cookies_section_5_text() },
    { title: m.cookies_section_6_title(), text: m.cookies_section_6_text() },
    { title: m.cookies_section_7_title(), text: m.cookies_section_7_text() },
    {
      title: m.cookies_section_8_title(),
      text: m.cookies_section_8_text({ email: contactEmail }),
    },
  ]

  const analyticsEnabled = pendingConsent === 'granted'

  const handleToggleAnalytics = () => {
    setPendingConsent((prev) => (prev === 'granted' ? 'denied' : 'granted'))
    setSaved(false)
  }

  const handleSave = () => {
    if (pendingConsent) {
      setConsent(pendingConsent)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 3000)
    }
  }

  const handleAcceptAll = () => {
    setPendingConsent('granted')
    setConsent('granted')
    setSaved(true)
    window.setTimeout(() => setSaved(false), 3000)
  }

  const handleRejectAll = () => {
    setPendingConsent('denied')
    setConsent('denied')
    setSaved(true)
    window.setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-4xl space-y-8'>
        <section className='island-shell rounded-2xl p-6 sm:p-8'>
          <div className='mb-6 flex items-center gap-3'>
            <div className='flex size-10 items-center justify-center rounded-full bg-accent-primary-subtle text-accent-primary'>
              <Cookie size={20} aria-hidden='true' />
            </div>
            <div>
              <p className='island-kicker mb-0.5'>{m.cookies_kicker()}</p>
              <h1 className='display-title text-3xl font-semibold text-text-primary sm:text-4xl'>
                {m.cookies_title()}
              </h1>
            </div>
          </div>
          <p className='max-w-3xl text-text-secondary'>{m.cookies_description()}</p>

          <div className='mt-8 space-y-4'>
            <CookieToggle
              title={m.cookies_section_3_title()}
              description={m.cookies_section_3_text()}
              checked={true}
              disabled={true}
              icon={<ShieldCheck size={18} aria-hidden='true' />}
            />
            <CookieToggle
              title={m.analytics_consent_title()}
              description={m.analytics_consent_description()}
              checked={analyticsEnabled}
              onChange={isRequired ? handleToggleAnalytics : undefined}
              disabled={!isRequired}
              icon={<Cookie size={18} aria-hidden='true' />}
            />
          </div>

          <div className='mt-6 flex flex-wrap items-center gap-3'>
            <Button type='button' onClick={handleAcceptAll}>
              {m.analytics_consent_accept()}
            </Button>
            <Button type='button' variant='secondary' onClick={handleRejectAll}>
              {m.analytics_consent_decline()}
            </Button>
            <Button
              type='button'
              variant='secondary'
              onClick={handleSave}
              disabled={!pendingConsent || pendingConsent === consent}
            >
              {saved ? (
                <>
                  <Check size={16} className='mr-1.5' aria-hidden='true' />
                  {m.cookie_settings_saved()}
                </>
              ) : (
                m.cookie_settings_save()
              )}
            </Button>
          </div>

          {saved && (
            <p className='mt-3 text-sm text-success' role='status'>
              {m.cookie_settings_saved_description()}
            </p>
          )}
        </section>

        <LegalPageLayout
          kicker={m.cookies_kicker()}
          title={m.cookies_title()}
          lastUpdated={m.legal_last_updated({ date: LAST_UPDATED })}
          sections={sections}
        />
      </div>
    </div>
  )
}
