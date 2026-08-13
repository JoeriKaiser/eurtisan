import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { authClient } from '#/lib/auth-client'
import { m } from '#/paraglide/messages'

export function AccountSecurity() {
  const [password, setPassword] = useState('')
  const [totpUri, setTotpUri] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [enabled, setEnabled] = useState(false)

  async function handleEnable(event: React.FormEvent) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const result = await authClient.twoFactor.enable({ password })
      if (result.error) {
        setError(result.error.message ?? 'Could not enable two-factor authentication.')
        return
      }
      setTotpUri(result.data?.totpURI ?? null)
      setBackupCodes(result.data?.backupCodes ?? null)
    } catch {
      setError('Could not enable two-factor authentication.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      const result = await authClient.twoFactor.verifyTotp({ code: verifyCode })
      if (result.error) {
        setError(result.error.message ?? 'Invalid verification code.')
        return
      }
      setEnabled(true)
      setTotpUri(null)
      setVerifyCode('')
    } catch {
      setError('Invalid verification code.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className='page-wrap px-4 py-12'>
      <section className='island-shell mx-auto max-w-lg rounded-2xl p-6 sm:p-8'>
        <h1 className='display-title mb-2 text-2xl font-semibold text-text-primary'>
          {m.account_security_title()}
        </h1>
        <p className='mb-6 text-sm text-text-secondary'>{m.account_security_description()}</p>
        <p className='mb-6 text-sm'>
          <Link
            to='/account/settings'
            className='text-accent-primary underline-offset-2 hover:underline'
          >
            {m.account_settings()}
          </Link>
        </p>

        {enabled ? (
          <p className='text-sm text-success' role='status'>
            {m.account_2fa_enabled()}
          </p>
        ) : !totpUri ? (
          <form onSubmit={handleEnable} className='space-y-4'>
            <div>
              <label
                htmlFor='2fa-password'
                className='mb-1.5 block text-sm font-medium text-text-primary'
              >
                Password
              </label>
              <Input
                id='2fa-password'
                type='password'
                autoComplete='current-password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className='text-sm text-error' role='alert'>
                {error}
              </p>
            )}
            <Button type='submit' isLoading={isLoading}>
              {m.account_2fa_enable()}
            </Button>
          </form>
        ) : (
          <div className='space-y-4'>
            <p className='text-sm text-text-secondary'>
              Scan this URI in your authenticator app, then enter the 6-digit code to confirm.
            </p>
            <p className='break-all rounded-lg bg-surface-inset p-3 font-mono text-xs text-text-primary'>
              {totpUri}
            </p>
            {backupCodes && backupCodes.length > 0 && (
              <div>
                <p className='mb-2 text-sm font-medium text-text-primary'>
                  Backup codes (save these):
                </p>
                <ul className='list-inside list-disc text-sm text-text-secondary'>
                  {backupCodes.map((code) => (
                    <li key={code} className='font-mono'>
                      {code}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <form onSubmit={handleVerify} className='space-y-4'>
              <div>
                <label
                  htmlFor='2fa-code'
                  className='mb-1.5 block text-sm font-medium text-text-primary'
                >
                  Verification code
                </label>
                <Input
                  id='2fa-code'
                  inputMode='numeric'
                  autoComplete='one-time-code'
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p className='text-sm text-error' role='alert'>
                  {error}
                </p>
              )}
              <Button type='submit' isLoading={isLoading}>
                Confirm two-factor authentication
              </Button>
            </form>
          </div>
        )}
      </section>
    </main>
  )
}
