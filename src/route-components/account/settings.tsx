import { Link, useLoaderData } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { deleteMyAccount, exportMyData } from '#/lib/account-data'
import { updateMyEmailPreference } from '#/lib/account-email-preferences'
import { m } from '#/paraglide/messages'

export function AccountSettings() {
  const { preferences: initialPreferences } = useLoaderData({ from: '/account/settings' })
  const [preferences, setPreferences] = useState(initialPreferences)
  const [preferenceStatus, setPreferenceStatus] = useState<
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
      window.location.href = '/'
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

            <div className='border-t border-border-default pt-6'>
              <h2 className='text-lg font-semibold text-text-primary'>
                {m.account_email_preferences_title()}
              </h2>
              <p className='mt-1 text-sm text-text-secondary'>
                {m.account_email_preferences_description()}
              </p>
              <div className='mt-4 space-y-4' aria-live='polite'>
                {preferences.map((preference) => {
                  const status = preferenceStatus[preference.category]
                  const getMessage = (key: string) =>
                    (m as unknown as Record<string, () => string>)[key]?.() ?? key
                  const label = getMessage(preference.labelKey)
                  const description = getMessage(preference.descriptionKey)
                  const isMarketing = preference.category === 'marketing'

                  return (
                    <div
                      key={preference.category}
                      className='flex items-start justify-between gap-4'
                    >
                      <div className='flex-1'>
                        <label
                          htmlFor={`preference-${preference.category}`}
                          className='block text-sm font-medium text-text-primary'
                        >
                          {label}
                        </label>
                        <p className='text-sm text-text-secondary'>{description}</p>
                        {isMarketing && (
                          <p className='text-xs text-text-secondary'>
                            {m.account_email_preference_marketing_note?.() ?? ''}
                          </p>
                        )}
                      </div>
                      <div className='flex min-w-[120px] flex-col items-end gap-1'>
                        <button
                          id={`preference-${preference.category}`}
                          type='button'
                          role='switch'
                          aria-checked={preference.enabled}
                          aria-label={label}
                          disabled={status === 'saving'}
                          onClick={() =>
                            handlePreferenceChange(preference.category, !preference.enabled)
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 ${
                            preference.enabled ? 'bg-accent-primary' : 'bg-gray-300'
                          } ${status === 'saving' ? 'opacity-70' : ''}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              preference.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className='h-4 text-xs'>
                          {status === 'saved' && (
                            <span className='text-success'>
                              {m.account_email_preference_saved()}
                            </span>
                          )}
                          {status === 'error' && (
                            <span className='text-error'>{m.account_email_preference_error()}</span>
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
                  disabled={!confirmEmail}
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
