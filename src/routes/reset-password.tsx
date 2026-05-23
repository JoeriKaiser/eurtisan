import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import z from 'zod'
import { AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { authClient } from '#/lib/auth-client'
import { guardGuest } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'
import { AuthShell } from '#/components/auth/AuthShell'
import { PasswordStrengthIndicator } from '#/components/auth/PasswordStrengthIndicator'

const resetPasswordSearchSchema = z.object({
  token: z.string().optional().catch(''),
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/reset-password')({
  validateSearch: resetPasswordSearchSchema,
  beforeLoad: async () => guardGuest(),
  component: ResetPassword,
})

function ResetPassword() {
  const { token, redirect } = Route.useSearch()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <AuthShell title={m.reset_password_title()}>
        <div className='space-y-4 text-center' role='alert' aria-live='assertive'>
          <div className='mx-auto flex size-12 items-center justify-center rounded-full bg-error/10 text-error'>
            <AlertTriangle size={24} />
          </div>
          <h2 className='text-md font-semibold text-text-primary'>
            {m.error_reset_token_invalid()}
          </h2>
          <p className='text-xs text-text-secondary'>{m.forgot_password_description()}</p>
          <div className='pt-2'>
            <Link
              to='/forgot-password'
              search={{ redirect }}
              className='inline-block w-full rounded-lg bg-accent-primary px-4 py-2.5 text-center text-sm font-semibold text-text-on-primary hover:bg-accent-primary/90 transition-colors'
            >
              {m.forgot_password_title()}
            </Link>
          </div>
        </div>
      </AuthShell>
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    const form = e.currentTarget
    const formPassword = (form.elements.namedItem('password') as HTMLInputElement).value
    const formConfirmPassword = (form.elements.namedItem('confirmPassword') as HTMLInputElement)
      .value

    setPassword(formPassword)
    setConfirmPassword(formConfirmPassword)

    if (formPassword.length < 8) {
      setError(m.password_rule_length())
      return
    }

    if (formPassword !== formConfirmPassword) {
      setError(m.error_passwords_do_not_match())
      return
    }

    setLoading(true)

    try {
      const result = await authClient.resetPassword({
        newPassword: formPassword,
        token,
      })

      if (result.error) {
        setError(result.error.message || m.error_reset_token_invalid())
      } else {
        setSuccess(true)
      }
    } catch {
      setError(m.error_unexpected())
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title={m.reset_password_title()}
      description={!success ? m.reset_password_description() : undefined}
    >
      {!success ? (
        <form onSubmit={handleSubmit} className='grid gap-3'>
          <div className='grid gap-1'>
            <label htmlFor='password' className='text-sm font-medium text-text-primary'>
              {m.field_new_password()}
            </label>
            <div className='relative'>
              <Input
                id='password'
                name='password'
                type={showPassword ? 'text' : 'password'}
                autoComplete='new-password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className='pr-10 w-full'
              />
              <button
                type='button'
                onClick={() => setShowPassword(!showPassword)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary focus:outline-none'
                aria-label={showPassword ? m.button_hide_password() : m.button_show_password()}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <PasswordStrengthIndicator password={password} />
          </div>

          <div className='grid gap-1'>
            <label htmlFor='confirmPassword' className='text-sm font-medium text-text-primary'>
              {m.field_confirm_password()}
            </label>
            <div className='relative'>
              <Input
                id='confirmPassword'
                name='confirmPassword'
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete='new-password'
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className='pr-10 w-full'
              />
              <button
                type='button'
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary focus:outline-none'
                aria-label={
                  showConfirmPassword ? m.button_hide_password() : m.button_show_password()
                }
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Button type='submit' isLoading={loading} className='w-full mt-1'>
            {m.button_reset_password()}
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
        <div className='space-y-4 text-center' aria-live='polite'>
          <div className='mx-auto flex size-12 items-center justify-center rounded-full bg-success/10 text-success'>
            <CheckCircle size={24} />
          </div>
          <p className='text-sm text-text-secondary'>{m.reset_password_success()}</p>
          <div className='pt-2'>
            <Link
              to='/signin'
              search={{ redirect }}
              className='inline-block w-full rounded-lg bg-accent-primary px-4 py-2.5 text-center text-sm font-semibold text-text-on-primary hover:bg-accent-primary/90 transition-colors'
            >
              {m.button_sign_in()}
            </Link>
          </div>
        </div>
      )}
    </AuthShell>
  )
}
