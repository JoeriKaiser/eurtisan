import { Link, type ErrorComponentProps } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

export function StatusError({ reset }: ErrorComponentProps) {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='mx-auto max-w-xl rounded-2xl border border-border-default bg-surface-default p-8 text-center'>
        <AlertTriangle className='mx-auto size-10 text-error' aria-hidden='true' />
        <h1 className='display-title mt-4 text-2xl text-text-primary'>
          {m.onboarding_status_error_title()}
        </h1>
        <p className='mt-2 text-text-secondary'>{m.onboarding_status_error_description()}</p>
        <div className='mt-6 flex justify-center gap-3'>
          <Button onClick={reset}>{m.action_try_again()}</Button>
          <Link
            to='/sell'
            className='inline-flex min-h-10 items-center rounded-lg border border-border-default px-4 text-sm font-semibold text-text-primary no-underline'
          >
            {m.onboarding_back_to_hub()}
          </Link>
        </div>
      </section>
    </main>
  )
}
