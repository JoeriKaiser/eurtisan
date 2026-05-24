import { Link, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { authClient } from '#/lib/auth-client'
import { m } from '#/paraglide/messages'
import { AuthShell } from '#/components/auth/AuthShell'
import { PasswordStrengthIndicator } from '#/components/auth/PasswordStrengthIndicator'

export function ResetPassword() {
  const { token, redirect } = useSearch({ from: '/reset-password' })
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [visibility, setVisibility] = useState({ password: false, confirmPassword: false })
  const [status, setStatus] = useState({ loading: false, error: '', success: false })

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

    const formEl = e.currentTarget
    const formPassword = (formEl.elements.namedItem('password') as HTMLInputElement).value
    const formConfirmPassword = (formEl.elements.namedItem('confirmPassword') as HTMLInputElement)
      .value

    setForm({ password: formPassword, confirmPassword: formConfirmPassword })

    if (formPassword.length < 8) {
      setStatus({ loading: false, error: m.password_rule_length(), success: false })
      return
    }

    if (formPassword !== formConfirmPassword) {
      setStatus({ loading: false, error: m.error_passwords_do_not_match(), success: false })
      return
    }

    setStatus({ loading: true, error: '', success: false })

    try {
      const result = await authClient.resetPassword({
        newPassword: formPassword,
        token,
      })

      if (result.error) {
        setStatus({
          loading: false,
          error: result.error.message || m.error_reset_token_invalid(),
          success: false,
        })
      } else {
        setStatus({ loading: false, error: '', success: true })
      }
    } catch {
      setStatus({ loading: false, error: m.error_unexpected(), success: false })
    }
  }

  return (
    <AuthShell
      title={m.reset_password_title()}
      description={!status.success ? m.reset_password_description() : undefined}
    >
      {!status.success ? (
        <form onSubmit={handleSubmit} className='grid gap-3'>
          <div className='grid gap-1'>
            <label htmlFor='password' className='text-sm font-medium text-text-primary'>
              {m.field_new_password()}
            </label>
            <div className='relative'>
              <Input
                id='password'
                name='password'
                type={visibility.password ? 'text' : 'password'}
                autoComplete='new-password'
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                required
                className='pr-10 w-full'
              />
              <button
                type='button'
                onClick={() => setVisibility((prev) => ({ ...prev, password: !prev.password }))}
                className='absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary focus:outline-none'
                aria-label={
                  visibility.password ? m.button_hide_password() : m.button_show_password()
                }
              >
                {visibility.password ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <PasswordStrengthIndicator password={form.password} />
          </div>

          <div className='grid gap-1'>
            <label htmlFor='confirmPassword' className='text-sm font-medium text-text-primary'>
              {m.field_confirm_password()}
            </label>
            <div className='relative'>
              <Input
                id='confirmPassword'
                name='confirmPassword'
                type={visibility.confirmPassword ? 'text' : 'password'}
                autoComplete='new-password'
                value={form.confirmPassword}
                onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                required
                className='pr-10 w-full'
              />
              <button
                type='button'
                onClick={() =>
                  setVisibility((prev) => ({ ...prev, confirmPassword: !prev.confirmPassword }))
                }
                className='absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary focus:outline-none'
                aria-label={
                  visibility.confirmPassword ? m.button_hide_password() : m.button_show_password()
                }
              >
                {visibility.confirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Button type='submit' isLoading={status.loading} className='w-full mt-1'>
            {m.button_reset_password()}
          </Button>

          {status.error && (
            <div
              className='rounded-lg border border-error bg-error-subtle p-3 flex items-start gap-2'
              role='alert'
              aria-live='assertive'
            >
              <AlertTriangle className='text-error shrink-0 mt-0.5' size={16} />
              <p className='text-xs text-error font-medium'>{status.error}</p>
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
