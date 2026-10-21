import { AlertTriangle } from 'lucide-react'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

export function AdminPayoutsError({ error, reset }: ErrorComponentProps) {
  return (
    <div className='text-center py-12'>
      <AlertTriangle size={48} className='mx-auto mb-4 text-error' aria-hidden='true' />
      <h1 className='mb-2 text-2xl font-semibold text-text-primary'>
        {m.admin_payouts_error_load()}
      </h1>
      <p className='mb-6 text-text-secondary'>
        {error instanceof Error ? error.message : String(error)}
      </p>
      {reset && (
        <Button variant='secondary' onClick={reset}>
          {m.admin_payouts_error_retry()}
        </Button>
      )}
    </div>
  )
}
