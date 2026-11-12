import type { ErrorComponentProps } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { Home, RotateCcw } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

export function RootError({ error, reset }: ErrorComponentProps) {
  const isDev = import.meta.env.DEV

  return (
    <main className='page-wrap px-4 py-20 text-center'>
      <h1 className='display-title mb-4 text-3xl font-semibold text-text-primary'>
        {m.checkout_error_generic()}
      </h1>
      <p className='mx-auto max-w-lg mb-8 text-base text-text-secondary'>
        {isDev ? (error instanceof Error ? error.message : String(error)) : m.error_unexpected()}
      </p>

      <div className='flex flex-wrap items-center justify-center gap-3'>
        {reset && (
          <Button variant='primary' size='md' onClick={reset}>
            <RotateCcw size={16} aria-hidden='true' />
            {m.admin_error_retry()}
          </Button>
        )}
        <Link
          to='/'
          className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border-default bg-surface-default px-4 text-sm font-semibold text-text-primary no-underline transition-colors hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary'
        >
          <Home size={16} aria-hidden='true' />
          {m.error_go_home()}
        </Link>
      </div>

      {isDev && error instanceof Error && error.stack && (
        <pre className='mx-auto mt-8 max-w-2xl overflow-auto rounded-xl bg-surface-inset p-4 text-left text-xs text-text-secondary'>
          {error.stack}
        </pre>
      )}
    </main>
  )
}
