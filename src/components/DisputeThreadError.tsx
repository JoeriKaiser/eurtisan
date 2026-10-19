import { Link } from '@tanstack/react-router'
import { ShieldAlert } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

export function DisputeThreadError({ error }: { error: unknown; reset?: () => void }) {
  const isForbidden =
    (error instanceof Error ? error.message : String(error)).toLowerCase().includes('forbidden') ||
    (error instanceof Error ? error.message : String(error)).toLowerCase().includes('permission')
  const isNotFound =
    (error instanceof Error ? error.message : String(error)).toLowerCase().includes('not found') ||
    (error instanceof Error ? error.message : String(error)).toLowerCase().includes('404')

  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <div className='mx-auto max-w-md text-center'>
        <div className='mb-4 inline-flex size-12 items-center justify-center rounded-full bg-error/10'>
          <ShieldAlert size={24} className='text-error' aria-hidden='true' />
        </div>
        <h1 className='display-title mb-2 text-2xl font-semibold text-text-primary'>
          {isForbidden
            ? m.dispute_forbidden()
            : isNotFound
              ? m.dispute_not_found()
              : m.dispute_error_load()}
        </h1>
        <p className='mb-8 text-sm text-text-secondary'>
          {error instanceof Error ? error.message : String(error)}
        </p>
        <Link to='/orders' className='inline-block no-underline'>
          <Button variant='secondary'>{m.orders_back_to_list()}</Button>
        </Link>
      </div>
    </main>
  )
}
