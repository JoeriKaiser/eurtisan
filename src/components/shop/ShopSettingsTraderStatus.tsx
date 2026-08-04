import type { TraderStatus } from '#/lib/shops/trader-status'
import { m } from '#/paraglide/messages'

interface ShopSettingsTraderStatusProps {
  traderStatus: TraderStatus | ''
  error: string | null
  onChange: (value: TraderStatus) => void
}

export function ShopSettingsTraderStatus({
  traderStatus,
  error,
  onChange,
}: ShopSettingsTraderStatusProps) {
  const descriptionIds = `shop-trader-status-description shop-trader-status-separation${
    error ? ' shop-trader-status-error' : ''
  }`

  return (
    <div className='rounded-xl border border-border-subtle p-4'>
      <fieldset aria-describedby={descriptionIds} aria-invalid={error ? 'true' : undefined}>
        <legend className='text-sm font-semibold text-text-primary'>
          {m.trader_status_label()}
          <span className='text-error' aria-hidden='true'>
            {' '}
            *
          </span>
        </legend>
        <p id='shop-trader-status-description' className='mt-1 text-xs text-text-muted'>
          {m.trader_status_description()}
        </p>
        <p id='shop-trader-status-separation' className='mt-2 text-xs text-text-muted'>
          {m.trader_status_separate_from_tax()}
        </p>

        <div className='mt-4 grid gap-3'>
          <label
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
              traderStatus === 'trader'
                ? 'border-accent-primary bg-accent-primary/10'
                : error
                  ? 'border-error'
                  : 'border-border-default hover:border-border-strong'
            }`}
          >
            <input
              id='shop-trader-status-trader'
              type='radio'
              name='shopTraderStatus'
              value='trader'
              checked={traderStatus === 'trader'}
              onChange={() => onChange('trader')}
              required
              aria-labelledby='shop-trader-status-trader-label'
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={`shop-trader-status-trader-description${
                error ? ' shop-trader-status-error' : ''
              }`}
              aria-errormessage={error ? 'shop-trader-status-error' : undefined}
              className='mt-0.5 size-4 shrink-0 accent-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
            />
            <span>
              <span
                id='shop-trader-status-trader-label'
                className='block text-sm font-semibold text-text-primary'
              >
                {m.trader_status_trader_label()}
              </span>
              <span
                id='shop-trader-status-trader-description'
                className='mt-1 block text-xs text-text-secondary'
              >
                {m.trader_status_trader_description()}
              </span>
            </span>
          </label>

          <label
            className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
              traderStatus === 'non_trader'
                ? 'border-accent-primary bg-accent-primary/10'
                : error
                  ? 'border-error'
                  : 'border-border-default hover:border-border-strong'
            }`}
          >
            <input
              id='shop-trader-status-non-trader'
              type='radio'
              name='shopTraderStatus'
              value='non_trader'
              checked={traderStatus === 'non_trader'}
              onChange={() => onChange('non_trader')}
              aria-labelledby='shop-trader-status-non-trader-label'
              required
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={`shop-trader-status-non-trader-description${
                error ? ' shop-trader-status-error' : ''
              }`}
              aria-errormessage={error ? 'shop-trader-status-error' : undefined}
              className='mt-0.5 size-4 shrink-0 accent-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
            />
            <span>
              <span
                id='shop-trader-status-non-trader-label'
                className='block text-sm font-semibold text-text-primary'
              >
                {m.trader_status_non_trader_label()}
              </span>
              <span
                id='shop-trader-status-non-trader-description'
                className='mt-1 block text-xs text-text-secondary'
              >
                {m.trader_status_non_trader_description()}
              </span>
            </span>
          </label>
        </div>

        {error && (
          <p id='shop-trader-status-error' role='alert' className='mt-3 text-sm text-error'>
            {error}
          </p>
        )}
      </fieldset>
    </div>
  )
}
