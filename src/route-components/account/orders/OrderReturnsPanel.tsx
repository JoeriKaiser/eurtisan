import { Link } from '@tanstack/react-router'
import { Package } from 'lucide-react'
import { Button } from '#/components/ui/button'
import type { ReturnRequestSummary } from '#/lib/returns'
import { m } from '#/paraglide/messages'

export interface OrderReturnsPanelProps {
  platformOrderId: string
  shopOrderId: string
  returns: ReturnRequestSummary[]
}

export function OrderReturnsPanel({
  platformOrderId,
  shopOrderId,
  returns,
}: OrderReturnsPanelProps) {
  return (
    <div className='flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3'>
      <div>
        <p className='text-sm font-medium text-text-primary'>{m.return_order_help_title()}</p>
        <p className='mt-1 text-xs text-text-muted'>{m.return_order_help()}</p>
      </div>
      <div className='flex flex-wrap gap-2'>
        {returns
          .filter((request) => request.shopOrderId === shopOrderId)
          .map((request) => (
            <Link
              key={request.id}
              to='/returns/$returnRequestId'
              params={{ returnRequestId: request.id }}
              className='inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-accent-primary no-underline hover:bg-accent-primary/5'
            >
              {m.return_view_request()}
            </Link>
          ))}
        <Link
          to='/orders/$platformOrderId/returns/new'
          params={{ platformOrderId }}
          search={{ shopOrderId }}
          className='no-underline'
        >
          <Button variant='secondary' size='sm' className='min-h-11'>
            <Package size={15} aria-hidden='true' />
            {m.return_start_request()}
          </Button>
        </Link>
      </div>
    </div>
  )
}
