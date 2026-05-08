import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/signin')({
  component: SignIn,
})

function SignIn() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        const result = await authClient.signUp.email({ email, password, name })
        if (result.error) {
          setError(result.error.message || m.error_sign_up_failed())
        } else {
          router.invalidate()
        }
      } else {
        const result = await authClient.signIn.email({ email, password })
        if (result.error) {
          setError(result.error.message || m.error_sign_in_failed())
        } else {
          router.invalidate()
        }
      }
    } catch {
      setError(m.error_unexpected())
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-md'>
        <div className='island-shell rounded-2xl p-6 sm:p-8'>
          <h1 className='display-title mb-2 text-2xl font-bold text-[var(--sea-ink)]'>
            {isSignUp ? m.sign_up_title() : m.sign_in_title()}
          </h1>
          <p className='mb-6 text-sm text-[var(--sea-ink-soft)]'>
            {isSignUp ? m.sign_up_description() : m.sign_in_description()}
          </p>

          <form onSubmit={handleSubmit} className='grid gap-4'>
            {isSignUp && (
              <div className='grid gap-2'>
                <label htmlFor='name' className='text-sm font-medium'>
                  {m.field_name()}
                </label>
                <input
                  id='name'
                  type='text'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className='flex h-9 w-full border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-100'
                  required
                />
              </div>
            )}

            <div className='grid gap-2'>
              <label htmlFor='email' className='text-sm font-medium'>
                {m.field_email()}
              </label>
              <input
                id='email'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className='flex h-9 w-full border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-100'
                required
              />
            </div>

            <div className='grid gap-2'>
              <label htmlFor='password' className='text-sm font-medium'>
                {m.field_password()}
              </label>
              <input
                id='password'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className='flex h-9 w-full border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 text-sm focus:outline-none focus:border-neutral-900 dark:focus:border-neutral-100'
                required
                minLength={8}
              />
            </div>

            {error && (
              <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3'>
                <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
              </div>
            )}

            <button
              type='submit'
              disabled={loading}
              className='w-full h-9 px-4 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {loading
                ? m.button_loading()
                : isSignUp
                  ? m.button_create_account()
                  : m.button_sign_in()}
            </button>
          </form>

          <div className='mt-4 text-center'>
            <button
              type='button'
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError('')
              }}
              className='text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors'
            >
              {isSignUp ? m.link_switch_to_sign_in() : m.link_switch_to_sign_up()}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
