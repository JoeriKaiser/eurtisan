import { AlertTriangle, Scale } from 'lucide-react'
import type { HTMLAttributes } from 'react'
import { cn } from '#/lib/cn'
import type { TraderStatus } from '#/lib/shops/trader-status'
import { m } from '#/paraglide/messages'

export interface TraderStatusDisclosureProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  traderStatus: TraderStatus | null
}

/**
 * Public CRD Article 6a seller-status disclosure.
 *
 * The declaration is displayed as provided by the seller. In particular, it
 * must never be derived from the separate DAC7 legal-entity classification.
 */
export function TraderStatusDisclosure({
  traderStatus,
  className,
  ...props
}: TraderStatusDisclosureProps) {
  const isUndeclared = traderStatus === null
  const Icon = isUndeclared ? AlertTriangle : Scale

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3',
        isUndeclared
          ? 'border-warning/30 bg-warning-subtle'
          : 'border-border-default bg-surface-inset',
        className,
      )}
      {...props}
    >
      <Icon
        size={18}
        className={cn('mt-0.5 shrink-0', isUndeclared ? 'text-warning-strong' : 'text-text-muted')}
        aria-hidden='true'
      />
      <div className='min-w-0 text-sm leading-relaxed'>
        <p className='m-0 font-medium text-text-primary'>
          {traderStatus === 'trader'
            ? m.trader_status_trader()
            : traderStatus === 'non_trader'
              ? m.trader_status_non_trader()
              : m.trader_status_undeclared()}
        </p>
        {traderStatus === 'non_trader' && (
          <p className='m-0 mt-1 text-text-secondary'>
            {m.trader_status_non_trader_rights_notice()}
          </p>
        )}
      </div>
    </div>
  )
}
