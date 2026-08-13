import { useState } from 'react'
import { AlertTriangle, Mail } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { FeedbackBanner } from '#/components/ui/FeedbackBanner'
import { authClient } from '#/lib/auth-client'
import { m } from '#/paraglide/messages'
import { AuthShell } from '#/components/auth/AuthShell'
import { useSearch } from '@tanstack/react-router'
import { useCountdown } from '#/hooks/useCountdown'

export function ForgotPassword() {
  const { redirect } = useSearch({ from: '/forgot-password' })
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState({ loading: false, error: '', success: false })
  const { remaining: cooldown, start: startCooldown } = useCountdown()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus({ loading: true, error: '', success: false })

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `/reset-password${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`,
      })

      if (result.error) {
        setStatus({
          loading: false,
          error: result.error.message || m.error_unexpected(),
          success: false,
        })
      } else {
        setStatus({ loading: false, error: '', success: true })
        startCooldown(60)
      }
    } catch {
      setStatus({ loading: false, error: m.error_unexpected(), success: false })
    }
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    setStatus((prev) => ({ ...prev, loading: true, error: '' }))

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `/reset-password${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`,
      })

      if (result.error) {
        setStatus((prev) => ({
          ...prev,
          loading: false,
          error: result.error.message || m.error_unexpected(),
        }))
      } else {
        startCooldown(60)
        setStatus((prev) => ({ ...prev, loading: false }))
      }
    } catch {
      setStatus((prev) => ({ ...prev, loading: false, error: m.error_unexpected() }))
    }
  }

  return (
    <AuthShell
      title={m.forgot_password_title()}
      description={!status.success ? m.forgot_password_description() : undefined}
    >
      {!status.success ? (
        <form onSubmit={handleSubmit} className='grid gap-3'>
          <div className='grid gap-1'>
            <label htmlFor='email' className='text-sm font-medium text-text-primary'>
              {m.field_email()}
            </label>
            <Input
              id='email'
              name='email'
              type='email'
              autoComplete='username email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className='w-full'
            />
          </div>

          <div className='min-h-12'>
            {status.error && <FeedbackBanner type='error' message={status.error} size='sm' />}
          </div>

          <Button type='submit' isLoading={status.loading} className='w-full mt-1'>
            {m.button_send_reset_link()}
          </Button>
        </form>
      ) : (
        <div className='space-y-4 text-center' aria-live='polite'>
          <div className='mx-auto flex size-12 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary'>
            <Mail size={24} />
          </div>
          <p className='text-sm text-text-secondary'>{m.forgot_password_success({ email })}</p>

          <div className='pt-2'>
            <Button
              type='button'
              variant='secondary'
              onClick={handleResend}
              disabled={cooldown > 0 || status.loading}
              isLoading={status.loading && cooldown === 0}
              className='w-full'
            >
              {cooldown > 0
                ? m.button_resend_cooldown({ seconds: String(cooldown) })
                : m.button_resend_verification()}
            </Button>
          </div>

          {status.error && (
            <div
              className='rounded-lg border border-error bg-error-subtle p-3 flex items-start gap-2 text-left'
              role='alert'
              aria-live='assertive'
            >
              <AlertTriangle className='text-error shrink-0 mt-0.5' size={16} />
              <p className='text-xs text-error font-medium'>{status.error}</p>
            </div>
          )}
        </div>
      )}
    </AuthShell>
  )
}
