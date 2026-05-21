import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import z from 'zod'
import { AlertTriangle, Mail } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { authClient } from '#/lib/auth-client'
import { guardGuest } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'
import { AuthShell } from '#/components/auth/AuthShell'

const forgotPasswordSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: async () => guardGuest(),
  validateSearch: forgotPasswordSearchSchema,
  component: ForgotPassword,
})

function ForgotPassword() {
  const { redirect } = Route.useSearch()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [cooldown, setCooldown] = useState(0)

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `/reset-password${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`,
      })

      if (result.error) {
        setError(result.error.message || m.error_unexpected())
      } else {
        setSuccess(true)
        setCooldown(60)
      }
    } catch {
      setError(m.error_unexpected())
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    setError('')
    setLoading(true)

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: `/reset-password${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`,
      })

      if (result.error) {
        setError(result.error.message || m.error_unexpected())
      } else {
        setCooldown(60)
      }
    } catch {
      setError(m.error_unexpected())
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={m.forgot_password_title()}
      description={!success ? m.forgot_password_description() : undefined}
    >
      {!success ? (
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

          <Button type='submit' isLoading={loading} className='w-full mt-1'>
            {m.button_send_reset_link()}
          </Button>

          {error && (
            <div
              className='rounded-lg border border-error bg-error-subtle p-3 flex items-start gap-2'
              role='alert'
              aria-live='assertive'
            >
              <AlertTriangle className='text-error shrink-0 mt-0.5' size={16} />
              <p className='text-xs text-error font-medium'>{error}</p>
            </div>
          )}
        </form>
      ) : (
        <div className='space-y-4 text-center' role='status' aria-live='polite'>
          <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary'>
            <Mail size={24} />
          </div>
          <p className='text-sm text-text-secondary'>{m.forgot_password_success({ email })}</p>

          <div className='pt-2'>
            <Button
              type='button'
              variant='secondary'
              onClick={handleResend}
              disabled={cooldown > 0 || loading}
              isLoading={loading && cooldown === 0}
              className='w-full'
            >
              {cooldown > 0
                ? m.button_resend_cooldown({ seconds: String(cooldown) })
                : m.button_resend_verification()}
            </Button>
          </div>

          {error && (
            <div
              className='rounded-lg border border-error bg-error-subtle p-3 flex items-start gap-2 text-left'
              role='alert'
              aria-live='assertive'
            >
              <AlertTriangle className='text-error shrink-0 mt-0.5' size={16} />
              <p className='text-xs text-error font-medium'>{error}</p>
            </div>
          )}
        </div>
      )}
    </AuthShell>
  )
}
