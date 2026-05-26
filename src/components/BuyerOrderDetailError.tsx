import { Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

export function BuyerOrderDetailError({ error }: { error: Error }) {
  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <div className='mx-auto max-w-3xl text-center'>
        <p className='text-text-secondary'>{m.orders_error()}</p>
        <p className='mt-2 text-sm text-text-muted'>{error.message}</p>
        <Link to='/orders' className='mt-4 inline-block no-underline'>
          <Button variant='secondary'>{m.orders_back_to_list()}</Button>
        </Link>
      </div>
    </main>
  )
}
