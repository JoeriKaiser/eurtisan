import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { deleteMyAccount, exportMyData } from '#/lib/account-data'
import { m } from '#/paraglide/messages'

export function AccountSettings() {
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
      } else if (message.includes('ACTIVE_SHOP_EXISTS')) {
        setDeleteError(m.account_delete_active_shop())
      } else {
        setDeleteError(m.account_delete_error())
      }
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
