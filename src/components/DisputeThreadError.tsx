import { Link } from '@tanstack/react-router'
import { ShieldAlert } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

export function DisputeThreadError({ error }: { error: Error }) {
  const isForbidden =
    error.message.toLowerCase().includes('forbidden') ||
    error.message.toLowerCase().includes('permission')
  const isNotFound =
    error.message.toLowerCase().includes('not found') || error.message.toLowerCase().includes('404')

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
        <p className='mb-8 text-sm text-text-secondary'>{error.message}</p>
        <Link to='/orders' className='inline-block no-underline'>
          <Button variant='secondary'>{m.orders_back_to_list()}</Button>
        </Link>
      </div>
    </main>
  )
}
