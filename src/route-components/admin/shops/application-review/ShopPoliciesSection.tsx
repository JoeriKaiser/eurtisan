import type { ShopDraft } from '#/lib/sell-onboarding'
import { m } from '#/paraglide/messages'

interface ShopPoliciesSectionProps {
  details: ShopDraft
}

export function ShopPoliciesSection({ details }: ShopPoliciesSectionProps) {
  return (
    <div className='space-y-2'>
      <h3 className='text-xs font-semibold uppercase tracking-wider text-text-muted'>
        {m.admin_shops_application_section_policies()}
      </h3>
      <div className='bg-surface-inset rounded-xl p-4 space-y-3 border border-border-subtle'>
        {details.shippingOrigin && (
          <div>
            <p className='text-xs text-text-muted'>{m.admin_shops_application_field_shipping()}</p>
            <p className='text-sm font-semibold text-text-primary mt-0.5'>
              {[
                details.shippingOrigin.city,
                details.shippingOrigin.state,
                details.shippingOrigin.country,
              ]
                .filter(Boolean)
                .join(', ')}
              {details.shippingOrigin.postalCode && ` (${details.shippingOrigin.postalCode})`}
            </p>
            <p className='text-xs text-text-secondary mt-1'>
              Processing time:{' '}
              <span className='font-mono'>
                {details.shippingOrigin.processingTimeDays?.min}–
                {details.shippingOrigin.processingTimeDays?.max}
              </span>{' '}
              days
              {details.shippingOrigin.shipsInternational
                ? ' (Ships Internationally)'
                : ' (Domestic shipping only)'}
            </p>
          </div>
        )}
        {details.policies && (
          <div className='pt-2 border-t border-border-subtle/50 space-y-2'>
            <p className='text-xs text-text-muted'>{m.admin_shops_application_field_policies()}</p>
            <div className='text-sm text-text-primary space-y-2'>
              <div>
                <span className='font-semibold text-text-secondary text-xs block'>Returns</span>
                {details.policies.returns?.accepted
                  ? `Accepted within ${details.policies.returns.windowDays} days`
                  : 'Not accepted'}
                {details.policies.returns?.conditions && (
                  <p className='text-xs text-text-secondary bg-surface-default p-2 rounded border border-border-subtle mt-1 italic'>
                    &ldquo;{details.policies.returns.conditions}&rdquo;
                  </p>
                )}
              </div>
              <div>
                <span className='font-semibold text-text-secondary text-xs block'>Exchanges</span>
                {details.policies.exchanges?.accepted ? 'Accepted' : 'Not accepted'}
                {details.policies.exchanges?.conditions && (
                  <p className='text-xs text-text-secondary bg-surface-default p-2 rounded border border-border-subtle mt-1 italic'>
                    &ldquo;{details.policies.exchanges.conditions}&rdquo;
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
