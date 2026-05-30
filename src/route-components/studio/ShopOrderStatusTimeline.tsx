import { CheckCircle2, Circle } from 'lucide-react'
import { FULFILLMENT_STATUSES, isStatusReached, statusTimelineLabel } from '#/lib/orders-ui'

export function ShopOrderStatusTimeline({ status }: { status: string }) {
  const isTerminal = ['cancelled', 'refunded', 'disputed'].includes(status)
  return (
    <div className='space-y-4'>
      <h3 className='text-sm font-semibold text-text-primary'>Fulfillment Timeline</h3>
      <ol className='relative flex items-center justify-between before:absolute before:left-0 before:right-0 before:top-1/2 before:h-0.5 before:-translate-y-1/2 before:bg-border-subtle'>
        {FULFILLMENT_STATUSES.map((step, idx) => {
          const reached = isStatusReached(status as never, step)
          const isCurrent = status === step
          const isLast = idx === FULFILLMENT_STATUSES.length - 1
          return (
            <li
              key={step}
              className='relative z-10 flex flex-1 flex-col items-center gap-2'
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div
                className={`flex size-6 items-center justify-center rounded-full border-2 transition-colors ${
                  reached
                    ? 'border-accent-primary bg-accent-primary text-text-on-primary'
                    : 'border-border-default bg-surface-default text-text-muted'
                } ${isCurrent ? 'ring-2 ring-accent-primary/30' : ''}`}
              >
                {reached ? (
                  <CheckCircle2 size={16} aria-hidden='true' />
                ) : (
                  <Circle size={16} aria-hidden='true' />
                )}
              </div>
              <span
                className={`text-center text-xs font-medium ${
                  reached ? 'text-text-primary' : 'text-text-muted'
                }`}
              >
                {statusTimelineLabel(step)}
              </span>
              {isLast && isTerminal && (
                <span className='text-center text-xs font-medium text-error'>
                  {status.replace('_', ' ')}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
