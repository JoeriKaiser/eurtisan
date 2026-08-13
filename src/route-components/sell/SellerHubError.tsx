import type { ErrorComponentProps } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

export function SellerHubError({ reset }: ErrorComponentProps) {
  return (
    <main className='page-wrap px-4 py-12'>
      <section className='mx-auto max-w-xl rounded-2xl border border-border-default bg-surface-default p-8 text-center'>
        <AlertTriangle className='mx-auto size-10 text-error' aria-hidden='true' />
        <h1 className='display-title mt-4 text-2xl text-text-primary'>
          {m.seller_hub_error_title()}
        </h1>
        <p className='mt-2 text-text-secondary'>{m.seller_hub_error_description()}</p>
        <Button className='mt-6' onClick={reset}>
          {m.action_try_again()}
        </Button>
      </section>
    </main>
  )
}
