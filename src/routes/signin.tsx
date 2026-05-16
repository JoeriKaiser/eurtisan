import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import z from 'zod'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { authClient } from '#/lib/auth-client'
import { guardGuest } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

const signinSearchSchema = z.object({
  redirect: z.string().optional(),
})

export function isLocalRedirect(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//')
}

export const Route = createFileRoute('/signin')({
  beforeLoad: async () => guardGuest(),
  validateSearch: signinSearchSchema,
  component: SignIn,
})

function SignIn() {
  const router = useRouter()
  const { redirect } = Route.useSearch()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const form = e.currentTarget
    const formEmail = (form.elements.namedItem('email') as HTMLInputElement).value.trim()
    const formPassword = (form.elements.namedItem('password') as HTMLInputElement).value
    const formName = isSignUp
      ? (form.elements.namedItem('name') as HTMLInputElement)?.value.trim() || ''
      : ''

    // Sync autofill values into state so the UI reflects them
    setEmail(formEmail)
    setPassword(formPassword)
    if (isSignUp) setName(formName)

    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        const result = await authClient.signUp.email({
          email: formEmail,
          password: formPassword,
          name: formName,
        })
        if (result.error) {
          setError(result.error.message || m.error_sign_up_failed())
        } else {
          await router.invalidate()
          if (redirect && isLocalRedirect(redirect)) {
            await router.navigate({ to: redirect })
          } else {
            await router.navigate({ to: '/' })
          }
        }
      } else {
        const result = await authClient.signIn.email({ email: formEmail, password: formPassword })
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

  return (
    <main className='page-wrap px-4 py-12'>
      <div className='mx-auto max-w-md'>
        <div className='island-shell rounded-2xl p-6 sm:p-8'>
          <h1 className='display-title mb-2 text-2xl font-bold text-text-primary'>
            {isSignUp ? m.sign_up_title() : m.sign_in_title()}
          </h1>
          <p className='mb-6 text-sm text-text-secondary'>
            {isSignUp ? m.sign_up_description() : m.sign_in_description()}
          </p>

          <form onSubmit={handleSubmit} className='grid gap-4'>
            {isSignUp && (
              <div className='grid gap-2'>
                <label htmlFor='name' className='text-sm font-medium'>
                  {m.field_name()}
                </label>
                <Input
                  id='name'
                  name='name'
                  type='text'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className='grid gap-2'>
              <label htmlFor='email' className='text-sm font-medium'>
                {m.field_email()}
              </label>
              <Input
                id='email'
                name='email'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className='grid gap-2'>
              <label htmlFor='password' className='text-sm font-medium'>
                {m.field_password()}
              </label>
              <Input
                id='password'
                name='password'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            {error && (
              <div className='rounded-lg border border-error bg-error-subtle p-3'>
                <p className='text-sm text-error'>{error}</p>
              </div>
            )}

            <Button type='submit' isLoading={loading} className='w-full'>
              {isSignUp ? m.button_create_account() : m.button_sign_in()}
            </Button>
          </form>

          <div className='mt-4 text-center'>
            <button
              type='button'
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError('')
              }}
              className='text-sm text-text-muted transition-colors duration-fast ease-out hover:text-text-primary'
            >
              {isSignUp ? m.link_switch_to_sign_in() : m.link_switch_to_sign_up()}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
