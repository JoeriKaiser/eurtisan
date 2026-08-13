import { Link, useLoaderData, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { AlertTriangle, CheckCircle, Mail, Loader2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { authClient } from '#/lib/auth-client'
import { isLocalRedirect } from '#/lib/auth-utils'
import { m } from '#/paraglide/messages'
import { AuthShell } from '#/components/auth/AuthShell'
import { useCountdown } from '#/hooks/useCountdown'

export function VerifyEmailPending() {
  return (
    <AuthShell title={m.verify_email_title()}>
      <div className='flex flex-col items-center justify-center gap-4 py-6' aria-live='polite'>
        <Loader2 className='size-6 animate-spin text-accent-primary' aria-hidden='true' />
        <p className='text-sm text-text-secondary'>{m.verify_email_pending()}</p>
      </div>
    </AuthShell>
  )
}

export function VerifyEmail() {
  const { email, redirect } = useSearch({ from: '/verify-email' })
  const verification = useLoaderData({ from: '/verify-email' })

  const [resend, setResend] = useState({
    loading: false,
    error: verification.status === 'error' ? m.error_unexpected() : '',
    info: '',
  })
  const { remaining: cooldown, start: startCooldown } = useCountdown()

  const handleResend = async () => {
    if (!email || cooldown > 0) return
    setResend({ loading: true, error: '', info: '' })

    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: redirect ? redirect : '/',
      })
      if (result.error) {
        setResend({ loading: false, error: result.error.message || m.error_unexpected(), info: '' })
      } else {
        setResend({ loading: false, error: '', info: m.verify_email_resend_success() })
        startCooldown(60)
      }
    } catch {
      setResend({ loading: false, error: m.error_unexpected(), info: '' })
    }
  }

  // Verification completed successfully
  if (verification.status === 'success') {
    return (
      <AuthShell title={m.verify_email_success_title()}>
        <div className='space-y-6 text-center font-medium' aria-live='polite'>
          <div className='mx-auto flex size-12 items-center justify-center rounded-full bg-success/10 text-success'>
            <CheckCircle size={24} />
          </div>
          <p className='text-sm text-text-secondary'>{m.verify_email_success_description()}</p>
          <div className='pt-2'>
            <a
              href={redirect && isLocalRedirect(redirect) ? redirect : '/'}
              className='inline-block w-full rounded-lg bg-accent-primary px-4 py-2.5 text-center text-sm font-semibold text-text-on-primary hover:bg-accent-primary/90 transition-colors shadow-sm'
            >
              {m.button_continue()}
            </a>
          </div>
        </div>
      </AuthShell>
    )
  }

  // Default "check your inbox" screen or token verification failed screen
  return (
    <AuthShell title={m.verify_email_title()}>
      <div className='space-y-6 text-center'>
        <div className='mx-auto flex size-12 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary'>
          <Mail size={24} />
        </div>

        <p className='text-sm text-text-secondary leading-relaxed'>
          {email ? m.verify_email_description({ email }) : m.verify_email_check_inbox()}
        </p>

        {email && (
          <div className='border-t border-border-default pt-6 space-y-4'>
            <div className='flex flex-col items-center gap-1.5'>
              <span className='text-xs text-text-muted'>{m.verify_email_resend_prompt()}</span>
              <Button
                type='button'
                variant='secondary'
                onClick={handleResend}
                disabled={cooldown > 0 || resend.loading}
                isLoading={resend.loading}
                className='w-full'
              >
                {cooldown > 0
                  ? m.button_resend_cooldown({ seconds: String(cooldown) })
                  : m.button_resend_verification()}
              </Button>
            </div>
          </div>
        )}

        {resend.error && (
          <div
            className='rounded-lg border border-error bg-error-subtle p-3 flex items-start gap-2 text-left'
            role='alert'
            aria-live='assertive'
          >
            <AlertTriangle className='text-error shrink-0 mt-0.5' size={16} />
            <p className='text-xs text-error font-medium'>{resend.error}</p>
          </div>
        )}

        {resend.info && (
          <div
            className='rounded-lg border border-border-default bg-surface-inset p-3 flex items-start gap-2 text-left'
            aria-live='polite'
          >
            <p className='text-xs text-text-secondary font-medium'>{resend.info}</p>
          </div>
        )}

        {!email && (
          <div className='border-t border-border-default pt-4'>
            <Link
              to='/signin'
              search={{ redirect }}
              className='text-xs font-semibold text-accent-primary hover:underline'
            >
              {m.button_sign_in()}
            </Link>
          </div>
        )}
      </div>
    </AuthShell>
  )
}
