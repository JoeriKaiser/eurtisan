import { m } from '#/paraglide/messages'
import { formatDate } from './order-date'

export interface OrderCancellationBannerProps {
  orderNumber: string
  cancelledAt: Date | null
  cancellationReason: string | null
}

export function OrderCancellationBanner({
  orderNumber,
  cancelledAt,
  cancellationReason,
}: OrderCancellationBannerProps) {
  return (
    <div className='mb-6 rounded-lg border border-error/20 bg-error-subtle p-4'>
      <p className='font-medium text-error'>{m.order_detail_cancelled()}</p>
      {cancelledAt && (
        <p className='mt-1 text-sm text-error/80'>
          {m.order_detail_cancelled_at({ date: formatDate(cancelledAt) })}
        </p>
      )}
      {cancellationReason && (
        <p className='mt-1 text-sm text-error/80'>
          {m.order_detail_cancellation_reason({ reason: cancellationReason })}
        </p>
      )}
      <a
        href={`mailto:support@eurtisan.eu?subject=Payment issue for order ${orderNumber}`}
        className='mt-3 inline-flex items-center gap-1 text-sm font-medium text-error underline-offset-2 hover:underline'
      >
        {m.order_detail_contact_support()}
      </a>
    </div>
  )
}
