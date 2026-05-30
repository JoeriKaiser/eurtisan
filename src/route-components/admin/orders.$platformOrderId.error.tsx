import { AlertTriangle } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { m } from '#/paraglide/messages'

export function AdminOrderDetailError({ error, reset }: { error: Error; reset?: () => void }) {
  return (
    <div className='pb-16 pt-8 text-center'>
      <AlertTriangle size={48} className='mx-auto mb-4 text-error' aria-hidden='true' />
      <h1 className='display-title mb-2 text-2xl font-semibold text-text-primary'>
        {m.admin_order_detail_error_load()}
      </h1>
      <p className='mb-6 text-text-secondary'>{error.message}</p>
      <div className='flex justify-center gap-3'>
        {reset && (
          <Button variant='secondary' onClick={reset}>
            {m.admin_orders_error_retry()}
          </Button>
        )}
        <Link to='/admin/orders' className='no-underline'>
          <Button variant='secondary'>{m.admin_orders_back_to_list()}</Button>
        </Link>
      </div>
    </div>
  )
}
