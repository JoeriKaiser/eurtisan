import { useRouter, Link, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { Eye, EyeOff, Apple, AlertTriangle } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { authClient } from '#/lib/auth-client'
import { isLocalRedirect } from '#/lib/auth-utils'
import { m } from '#/paraglide/messages'
import { AuthShell } from '#/components/auth/AuthShell'
import { PasswordStrengthIndicator } from '#/components/auth/PasswordStrengthIndicator'

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox='0 0 24 24'
    width='16'
    height='16'
    fill='currentColor'
    role='img'
    aria-label='Google'
    {...props}
  >
    <path
      d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
      fill='#4285F4'
    />
    <path
      d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
      fill='#34A853'
    />
    <path
      d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z'
      fill='#FBBC05'
    />
    <path
      d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
      fill='#EA4335'
    />
  </svg>
)

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox='0 0 16 16'
    width='16'
    height='16'
    fill='currentColor'
    role='img'
    aria-label='GitHub'
    {...props}
  >
    <path d='M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z' />
  </svg>
)

export function SignIn() {
  const router = useRouter()
  const { redirect } = useSearch({ from: '/signin' })
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setInfoMessage('')

    const form = e.currentTarget
    const formEmail = (form.elements.namedItem('email') as HTMLInputElement).value.trim()
    const formPassword = (form.elements.namedItem('password') as HTMLInputElement).value
    const formConfirmPassword = isSignUp
      ? (form.elements.namedItem('confirmPassword') as HTMLInputElement)?.value || ''
      : ''
    const formName = isSignUp
      ? (form.elements.namedItem('name') as HTMLInputElement)?.value.trim() || ''
      : ''

    setEmail(formEmail)
    setPassword(formPassword)
    if (isSignUp) {
      setConfirmPassword(formConfirmPassword)
      setName(formName)

      if (!formName) {
        setError(m.error_unexpected())
        return
      }
      if (formPassword.length < 8) {
        setError(m.password_rule_length())
        return
      }
      if (formPassword !== formConfirmPassword) {
        setError(m.error_passwords_do_not_match())
        return
      }
    }

    setLoading(true)

    try {
      if (isSignUp) {
        const result = await authClient.signUp.email({
          email: formEmail,
          password: formPassword,
          name: formName,
          callbackURL: redirect && isLocalRedirect(redirect) ? redirect : '/',
        })
        if (result.error) {
          setError(result.error.message || m.error_sign_up_failed())
        } else {
          await router.invalidate()
          await router.navigate({
            to: '/verify-email',
            search: { email: formEmail, redirect },
          })
        }
      } else {
        const result = await authClient.signIn.email({
          email: formEmail,
          password: formPassword,
        })
        if (result.error) {
          setError(result.error.message || m.error_sign_in_failed())
        } else {
          await router.invalidate()
          if (redirect && isLocalRedirect(redirect)) {
            await router.navigate({ to: redirect })
          } else {
            await router.navigate({ to: '/' })
          }
        }
      }
    } catch {
      setError(m.error_unexpected())
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthClick = (_provider: string) => {
    setError('')
    setInfoMessage(m.oauth_social_toast())
  }

  return (
    <AuthShell
      title={isSignUp ? m.sign_up_title() : m.sign_in_title()}
      description={isSignUp ? m.sign_up_description() : m.sign_in_description()}
    >
      <form onSubmit={handleSubmit} className='grid gap-3'>
        {isSignUp && (
          <div className='grid gap-1'>
            <label htmlFor='name' className='text-sm font-medium text-text-primary'>
              {m.field_name()}
            </label>
            <Input
              id='name'
              name='name'
              type='text'
              autoComplete='name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className='w-full'
            />
          </div>
        )}

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

        <div className='grid gap-1'>
          <div className='flex items-center justify-between'>
            <label htmlFor='password' className='text-sm font-medium text-text-primary'>
              {m.field_password()}
            </label>
            {!isSignUp && (
              <Link
                to='/forgot-password'
                className='text-xs font-medium text-accent-primary hover:underline'
              >
                {m.forgot_password_title()}
              </Link>
            )}
          </div>
          <div className='relative'>
            <Input
              id='password'
              name='password'
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
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

          {isSignUp && <PasswordStrengthIndicator password={password} />}
        </div>

        {isSignUp && (
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
        )}

        <Button type='submit' isLoading={loading} className='w-full mt-1'>
          {isSignUp ? m.button_create_account() : m.button_sign_in()}
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

        {infoMessage && (
          <div
            className='rounded-lg border border-border-default bg-surface-inset p-3 flex items-start gap-2'
            aria-live='polite'
          >
            <p className='text-xs text-text-secondary font-medium'>{infoMessage}</p>
          </div>
        )}
      </form>

      <div className='mt-5 text-center'>
        <button
          type='button'
          onClick={() => {
            setIsSignUp(!isSignUp)
            setError('')
            setInfoMessage('')
          }}
          className='text-sm text-text-muted transition-colors duration-fast ease-out hover:text-text-primary font-medium'
        >
          {isSignUp ? m.link_switch_to_sign_in() : m.link_switch_to_sign_up()}
        </button>
      </div>

      <div className='relative my-6'>
        <div className='absolute inset-0 flex items-center' aria-hidden='true'>
          <div className='w-full border-t border-border-default' />
        </div>
        <div className='relative flex justify-center text-xs uppercase'>
          <span className='bg-surface-default px-2 text-text-muted font-medium'>
            {m.oauth_or_separator()}
          </span>
        </div>
      </div>

      <div className='grid grid-cols-3 gap-3'>
        <Button
          type='button'
          variant='secondary'
          onClick={() => handleOAuthClick('google')}
          className='w-full flex items-center justify-center py-2'
          aria-label='Continue with Google'
        >
          <GoogleIcon />
        </Button>
        <Button
          type='button'
          variant='secondary'
          onClick={() => handleOAuthClick('github')}
          className='w-full flex items-center justify-center py-2'
          aria-label='Continue with GitHub'
        >
          <GithubIcon />
        </Button>
        <Button
          type='button'
          variant='secondary'
          onClick={() => handleOAuthClick('apple')}
          className='w-full flex items-center justify-center py-2'
          aria-label='Continue with Apple'
        >
          <Apple size={16} />
        </Button>
      </div>
    </AuthShell>
  )
}
