import { Link, useLoaderData } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Switch } from '#/components/ui/switch'
import { deleteMyAccount, exportMyData } from '#/lib/account-data'
import { updateMyEmailPreference } from '#/lib/account-email-preferences'
import {
  updateMyInAppNotificationPreference,
  type InAppNotificationPreference,
  type OptionalInAppNotificationType,
} from '#/lib/notifications/preferences'
import { m } from '#/paraglide/messages'

export function AccountSettings() {
  const {
    preferences: initialPreferences,
    inAppPreferences: initialInApp,
    user,
  } = useLoaderData({
    from: '/account/settings',
  }) as {
    preferences: Array<{
      category: string
      enabled: boolean
      labelKey: string
      descriptionKey: string
    }>
    inAppPreferences: InAppNotificationPreference[]
    user?: { role?: string }
  }
  const [preferences, setPreferences] = useState(initialPreferences)
  const [inAppPreferences, setInAppPreferences] =
    useState<InAppNotificationPreference[]>(initialInApp)

  const visiblePreferences = preferences.filter(
    (preference) =>
      preference.category !== 'marketing' &&
      !(preference.category === 'seller_updates' && user?.role === 'customer'),
  )
  const [preferenceStatus, setPreferenceStatus] = useState<
    Record<string, 'idle' | 'saving' | 'saved' | 'error'>
  >({})
  const [inAppStatus, setInAppStatus] = useState<
    Record<string, 'idle' | 'saving' | 'saved' | 'error'>
  >({})
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmEmail, setConfirmEmail] = useState('')

  async function handleExport() {
    setExportStatus('loading')
    try {
      const data = await exportMyData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `eurtisan-data-export-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setExportStatus('success')
    } catch {
      setExportStatus('error')
    }
  }

  async function handleDelete(event: React.FormEvent) {
    event.preventDefault()
    setDeleteStatus('loading')
    setDeleteError(null)
    try {
      await deleteMyAccount({ data: { confirmEmail } })
      window.location.href = '/?accountDeleted=1'
    } catch (err) {
      setDeleteStatus('error')
      const message = err instanceof Error ? err.message : ''
      if (message.includes('EMAIL_MISMATCH')) {
        setDeleteError(m.account_delete_email_mismatch())
      } else {
        setDeleteError(m.account_delete_error())
      }
    }
  }

  async function handlePreferenceChange(category: string, enabled: boolean) {
    setPreferenceStatus((prev) => ({ ...prev, [category]: 'saving' }))
    setPreferences((prev) => prev.map((p) => (p.category === category ? { ...p, enabled } : p)))

    try {
      await updateMyEmailPreference({
        data: {
          category: category as 'seller_updates' | 'marketing' | 'platform_announcements',
          enabled,
        },
      })
      setPreferenceStatus((prev) => ({ ...prev, [category]: 'saved' }))
      window.setTimeout(() => {
        setPreferenceStatus((prev) => ({ ...prev, [category]: 'idle' }))
      }, 2000)
    } catch {
      setPreferenceStatus((prev) => ({ ...prev, [category]: 'error' }))
      setPreferences((prev) =>
        prev.map((p) => (p.category === category ? { ...p, enabled: !enabled } : p)),
      )
    }
  }
  async function handleInAppPreferenceChange(
    type: OptionalInAppNotificationType,
    enabled: boolean,
  ) {
    setInAppStatus((prev) => ({ ...prev, [type]: 'saving' }))
    setInAppPreferences((prev) => prev.map((p) => (p.type === type ? { ...p, enabled } : p)))

    try {
      await updateMyInAppNotificationPreference({
        data: {
          type,
          enabled,
        },
      })
      setInAppStatus((prev) => ({ ...prev, [type]: 'saved' }))
      window.setTimeout(() => {
        setInAppStatus((prev) => ({ ...prev, [type]: 'idle' }))
      }, 2000)
    } catch {
      setInAppStatus((prev) => ({ ...prev, [type]: 'error' }))
      setInAppPreferences((prev) =>
        prev.map((p) => (p.type === type ? { ...p, enabled: !enabled } : p)),
      )
    }
  }

  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-2xl space-y-8'>
        <section className='island-shell rounded-2xl p-6 sm:p-8'>
          <h1 className='display-title mb-2 text-3xl font-semibold text-text-primary'>
            {m.account_settings()}
          </h1>
          <p className='mb-6 text-text-secondary'>
            <Link
              to='/account/security'
              className='text-accent-primary underline-offset-2 hover:underline'
            >
              {m.account_security_title()}
            </Link>
          </p>

          <div className='space-y-6 border-t border-border-default pt-6'>
            <div>
              <h2 className='text-lg font-semibold text-text-primary'>{m.account_export_data()}</h2>
              <p className='mt-1 text-sm text-text-secondary'>{m.account_export_description()}</p>
              <Button
                type='button'
                className='mt-4'
                isLoading={exportStatus === 'loading'}
                onClick={handleExport}
              >
                {m.account_export_data()}
              </Button>
              {exportStatus === 'success' && (
                <p className='mt-2 text-sm text-success' role='status'>
                  {m.account_export_success()}
                </p>
              )}
              {exportStatus === 'error' && (
                <p className='mt-2 text-sm text-error' role='alert'>
                  {m.account_export_error()}
                </p>
              )}
            </div>

            {visiblePreferences.length > 0 && (
              <div className='border-t border-border-default pt-6'>
                <h2 className='text-lg font-semibold text-text-primary'>
                  {m.account_email_preferences_title()}
                </h2>
                <p className='mt-1 text-sm text-text-secondary'>
                  {m.account_email_preferences_description()}
                </p>
                <div className='mt-4 space-y-4' aria-live='polite'>
                  {visiblePreferences.map((preference) => {
                    const status = preferenceStatus[preference.category]
                    const getMessage = (key: string) =>
                      (m as unknown as Record<string, () => string>)[key]?.() ?? key
                    const label = getMessage(preference.labelKey)
                    const description = getMessage(preference.descriptionKey)

                    return (
                      <div
                        key={preference.category}
                        className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4'
                      >
                        <div className='flex-1'>
                          <label
                            htmlFor={`preference-${preference.category}`}
                            className='block text-sm font-medium text-text-primary'
                          >
                            {label}
                          </label>
                          <p className='text-sm text-text-secondary'>{description}</p>
                        </div>
                        <div className='flex min-h-11 w-full flex-row-reverse items-center justify-between gap-2 sm:min-h-0 sm:w-auto sm:min-w-[120px] sm:flex-col sm:items-end sm:justify-start sm:gap-1'>
                          <Switch
                            id={`preference-${preference.category}`}
                            checked={preference.enabled}
                            aria-label={label}
                            disabled={status === 'saving'}
                            onCheckedChange={(enabled) =>
                              handlePreferenceChange(preference.category, enabled)
                            }
                          />
                          <span className='h-4 text-xs'>
                            {status === 'saved' && (
                              <span className='text-success'>
                                {m.account_email_preference_saved()}
                              </span>
                            )}
                            {status === 'error' && (
                              <span className='text-error'>
                                {m.account_email_preference_error()}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div className='border-t border-border-default pt-6'>
              <h2 className='text-lg font-semibold text-text-primary'>
                {m.account_in_app_preferences_title()}
              </h2>
              <p className='mt-1 text-sm text-text-secondary'>
                {m.account_in_app_preferences_description()}
              </p>
              <div className='mt-3 rounded-xl border border-border-default bg-bg-inset p-3.5 text-xs leading-relaxed text-text-secondary'>
                {m.account_in_app_preferences_mandatory_note()}
              </div>
              <div className='mt-4 space-y-4' aria-live='polite'>
                {inAppPreferences.map((preference) => {
                  const status = inAppStatus[preference.type]
                  const getMessage = (key: string) =>
                    (m as unknown as Record<string, () => string>)[key]?.() ?? key
                  const label = getMessage(preference.labelKey)
                  const description = getMessage(preference.descriptionKey)

                  return (
                    <div
                      key={preference.type}
                      className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4'
                    >
                      <div className='flex-1'>
                        <label
                          htmlFor={`in-app-pref-${preference.type}`}
                          className='block text-sm font-medium text-text-primary'
                        >
                          {label}
                        </label>
                        <p className='text-sm text-text-secondary'>{description}</p>
                      </div>
                      <div className='flex min-h-11 w-full flex-row-reverse items-center justify-between gap-2 sm:min-h-0 sm:w-auto sm:min-w-[120px] sm:flex-col sm:items-end sm:justify-start sm:gap-1'>
                        <Switch
                          id={`in-app-pref-${preference.type}`}
                          checked={preference.enabled}
                          aria-label={label}
                          disabled={status === 'saving'}
                          onCheckedChange={(enabled) =>
                            handleInAppPreferenceChange(preference.type, enabled)
                          }
                        />
                        <span className='h-4 text-xs'>
                          {status === 'saved' && (
                            <span className='text-success' role='status'>
                              {m.account_in_app_preference_saved()}
                            </span>
                          )}
                          {status === 'error' && (
                            <span className='text-error' role='alert'>
                              {m.account_in_app_preference_error()}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className='border-t border-border-default pt-6'>
              <h2 className='text-lg font-semibold text-error'>{m.account_delete_account()}</h2>
              <p className='mt-1 text-sm text-text-secondary'>{m.account_delete_description()}</p>
              <form onSubmit={handleDelete} className='mt-4 space-y-4'>
                <div>
                  <label
                    htmlFor='confirm-email'
                    className='mb-1.5 block text-sm font-medium text-text-primary'
                  >
                    {m.account_delete_confirm_label()}
                  </label>
                  <Input
                    id='confirm-email'
                    type='email'
                    autoComplete='email'
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder={m.account_delete_confirm_placeholder()}
                    required
                  />
                </div>
                {deleteError && (
                  <p className='text-sm text-error' role='alert'>
                    {deleteError}
                  </p>
                )}
                <Button
                  type='submit'
                  variant='danger'
                  isLoading={deleteStatus === 'loading'}
                  className='text-white'
                >
                  {m.account_delete_submit()}
                </Button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
