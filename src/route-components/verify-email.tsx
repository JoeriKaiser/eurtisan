import { Link, useRouter } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, Mail, Loader2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { authClient } from '#/lib/auth-client'
import { isLocalRedirect } from '#/lib/auth-utils'
import { m } from '#/paraglide/messages'
import { AuthShell } from '#/components/auth/AuthShell'
import { useSearch } from '@tanstack/react-router'

export function VerifyEmail() {
  const router = useRouter()
  const { email, token, redirect } = useSearch({ from: '/verify-email' })

  const [verification, setVerification] = useState({ verifying: !!token, success: false })
  const [resend, setResend] = useState({ loading: false, error: '', info: '' })
  const [cooldown, setCooldown] = useState(0)

  // Handle automatic verification if token is present
  useEffect(() => {
    if (token) {
      const verify = async () => {
        try {
          const result = await authClient.verifyEmail({
            query: {
              token,
            },
          })
          if (result.error) {
            setResend((prev) => ({ ...prev, error: result.error.message || m.error_unexpected() }))
          } else {
            setVerification({ verifying: false, success: true })
            await router.invalidate()
          }
        } catch {
          setResend((prev) => ({ ...prev, error: m.error_unexpected() }))
        } finally {
          setVerification((prev) => ({ ...prev, verifying: false }))
        }
      }
      void verify()
    }
  }, [token, router])

  // Cooldown timer effect
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1)
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [cooldown])

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
        setCooldown(60)
      }
    } catch {
      setResend({ loading: false, error: m.error_unexpected(), info: '' })
    }
  }

  // Verification in progress
  if (verification.verifying) {
    return (
      <AuthShell title={m.verify_email_title()}>
        <div className='flex flex-col items-center justify-center gap-4 py-6' aria-live='polite'>
          <Loader2 className='size-6 animate-spin text-accent-primary' />
          <p className='text-sm text-text-secondary'>Verifying your email address, please wait…</p>
        </div>
      </AuthShell>
    )
  }

  // Verification completed successfully
  if (verification.success) {
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
          {email
            ? m.verify_email_description({ email })
            : 'Please check your inbox and click the verification link we sent to verify your account.'}
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
