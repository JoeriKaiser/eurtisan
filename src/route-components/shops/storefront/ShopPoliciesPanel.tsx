import { Check, Globe2, Scale, X } from 'lucide-react'
import type { ShopOriginSummary, ShopPolicySummary } from '#/lib/shop-profile'
import { m } from '#/paraglide/messages'
import { countryName } from './labels'

export interface ShopPoliciesPanelProps {
  policies: ShopPolicySummary | null
  origin: ShopOriginSummary | null
}

function PolicyRow({ accepted, children }: { accepted: boolean; children: React.ReactNode }) {
  return (
    <li className='flex items-start gap-2.5 text-sm text-text-secondary'>
      {/* Icon and text both carry the meaning; state is never conveyed by
          colour or glyph alone. */}
      {accepted ? (
        <Check size={16} className='mt-0.5 shrink-0 text-success' aria-hidden='true' />
      ) : (
        <X size={16} className='mt-0.5 shrink-0 text-text-muted' aria-hidden='true' />
      )}
      <span>{children}</span>
    </li>
  )
}

function returnsLabel(returns: ShopPolicySummary['returns']): string {
  if (!returns.accepted) return m.shop_returns_not_accepted()
  return returns.windowDays
    ? m.shop_returns_accepted({ days: returns.windowDays })
    : m.shop_returns_accepted_no_window()
}

function exchangesLabel(exchanges: ShopPolicySummary['exchanges']): string {
  if (!exchanges.accepted) return m.shop_exchanges_not_accepted()
  return exchanges.windowDays
    ? m.shop_exchanges_accepted({ days: exchanges.windowDays })
    : m.shop_exchanges_accepted_no_window()
}

/**
 * The shop's own returns, exchanges, and custom-order terms.
 *
 * The statutory-rights notice is rendered unconditionally alongside them. A
 * seller confirms at onboarding that mandatory consumer rights still apply
 * (`policiesSchema.mandatoryRightsAcknowledged`); publishing a restrictive
 * policy without that notice would misrepresent the buyer's legal position, so
 * it is not conditional on what the seller chose.
 */
export function ShopPoliciesPanel({ policies, origin }: ShopPoliciesPanelProps) {
  if (!policies) return null

  const additional = policies.additionalInfo?.trim()

  return (
    <section
      id='policies'
      className='island-shell mt-8 scroll-mt-24 rounded-2xl px-6 py-8 sm:px-10'
    >
      <h2 className='mb-4 text-xl font-semibold text-text-primary'>{m.shop_policies_heading()}</h2>

      <ul className='flex flex-col gap-2.5'>
        <PolicyRow accepted={policies.returns.accepted}>
          {returnsLabel(policies.returns)}
          {policies.returns.conditions?.trim() && (
            <span className='block text-text-muted'>{policies.returns.conditions.trim()}</span>
          )}
        </PolicyRow>

        <PolicyRow accepted={policies.exchanges.accepted}>
          {exchangesLabel(policies.exchanges)}
          {policies.exchanges.conditions?.trim() && (
            <span className='block text-text-muted'>{policies.exchanges.conditions.trim()}</span>
          )}
        </PolicyRow>

        <PolicyRow accepted={policies.customOrders.accepted}>
          {policies.customOrders.accepted
            ? m.shop_custom_orders_accepted()
            : m.shop_custom_orders_not_accepted()}
          {policies.customOrders.details?.trim() && (
            <span className='block text-text-muted'>{policies.customOrders.details.trim()}</span>
          )}
        </PolicyRow>

        {/* Omitted rather than guessed when `shipsInternational` is absent:
            "ships internationally" and "domestic only" are both claims a buyer
            may act on, and there is no safe default between them. */}
        {origin?.shipsInternational !== undefined && (
          <li className='flex items-start gap-2.5 text-sm text-text-secondary'>
            <Globe2 size={16} className='mt-0.5 shrink-0 text-text-muted' aria-hidden='true' />
            <span>
              {origin.shipsInternational
                ? m.shop_ships_international()
                : m.shop_ships_domestic_only({ country: countryName(origin.country) })}
            </span>
          </li>
        )}
      </ul>

      {additional && (
        <div className='mt-6'>
          <h3 className='mb-1.5 text-sm font-medium text-text-primary'>
            {m.shop_policies_additional()}
          </h3>
          <p className='m-0 whitespace-pre-line text-sm leading-relaxed text-text-secondary'>
            {additional}
          </p>
        </div>
      )}

      <p className='mt-6 flex gap-2.5 rounded-xl bg-surface-inset px-4 py-3 text-sm leading-relaxed text-text-secondary'>
        <Scale size={16} className='mt-0.5 shrink-0 text-text-muted' aria-hidden='true' />
        <span>{m.shop_policies_statutory_rights()}</span>
      </p>
    </section>
  )
}
