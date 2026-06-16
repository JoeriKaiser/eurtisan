import { useEffect, useState } from 'react'
import { m } from '#/paraglide/messages'
import type { Policies } from '#/lib/sell-onboarding'

interface ShopSettingsPoliciesProps {
  policies: Policies | null
  onChange: (policies: Policies | null) => void
}

type PolicyPreset = 'no' | 'yes14' | 'yes30' | 'custom'

const presets: { value: PolicyPreset; label: string }[] = [
  { value: 'no', label: 'Not accepted' },
  { value: 'yes14', label: 'Accepted within 14 days' },
  { value: 'yes30', label: 'Accepted within 30 days' },
  { value: 'custom', label: 'Custom' },
]

function PolicyCard({
  title,
  preset,
  onPresetChange,
  children,
}: {
  title: string
  preset: PolicyPreset
  onPresetChange: (p: PolicyPreset) => void
  children: React.ReactNode
}) {
  return (
    <div className='rounded-xl border border-border-default p-4'>
      <h4 className='mb-3 text-sm font-medium text-text-primary'>{title}</h4>
      <div className='mb-3 flex flex-wrap gap-2'>
        {presets.map((p) => (
          <button
            key={p.value}
            type='button'
            onClick={() => onPresetChange(p.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              preset === p.value
                ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                : 'border-border-default text-text-secondary hover:border-accent-secondary'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && children}
    </div>
  )
}

export function ShopSettingsPolicies({ policies, onChange }: ShopSettingsPoliciesProps) {
  const [returns, setReturns] = useState({
    preset: (policies?.returns?.accepted
      ? policies.returns.windowDays === 14
        ? 'yes14'
        : policies.returns.windowDays === 30
          ? 'yes30'
          : 'custom'
      : 'no') as PolicyPreset,
    conditions: policies?.returns?.conditions ?? '',
  })

  const [exchanges, setExchanges] = useState({
    preset: (policies?.exchanges?.accepted
      ? policies.exchanges.conditions
        ? 'custom'
        : 'yes14'
      : 'no') as PolicyPreset,
    conditions: policies?.exchanges?.conditions ?? '',
  })

  const [custom, setCustom] = useState({
    preset: (policies?.customOrders?.accepted
      ? policies.customOrders.details
        ? 'custom'
        : 'yes14'
      : 'no') as PolicyPreset,
    details: policies?.customOrders?.details ?? '',
  })

  const [additionalInfo, setAdditionalInfo] = useState(policies?.additionalInfo ?? '')

  useEffect(() => {
    const hasReturns = returns.preset !== 'no'
    const hasExchanges = exchanges.preset !== 'no'
    const hasCustom = custom.preset !== 'no'

    if (!hasReturns && !hasExchanges && !hasCustom && !additionalInfo.trim()) {
      onChange(null)
      return
    }

    onChange({
      returns: {
        accepted: hasReturns,
        windowDays: returns.preset === 'yes14' ? 14 : returns.preset === 'yes30' ? 30 : undefined,
        conditions: returns.preset === 'custom' ? returns.conditions : undefined,
      },
      exchanges: {
        accepted: hasExchanges,
        conditions: exchanges.preset === 'custom' ? exchanges.conditions : undefined,
      },
      customOrders: {
        accepted: hasCustom,
        details: custom.preset === 'custom' ? custom.details : undefined,
      },
      paymentMethods: policies?.paymentMethods ?? [],
      additionalInfo: additionalInfo.trim() || undefined,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returns, exchanges, custom, additionalInfo, policies?.paymentMethods, onChange])

  return (
    <div className='rounded-xl border border-border-subtle p-4'>
      <h3 className='mb-1 text-sm font-semibold text-text-primary'>
        {m.creator_shop_policies_title()}
      </h3>
      <p className='mb-4 text-xs text-text-muted'>{m.creator_shop_policies_description()}</p>

      <div className='space-y-4'>
        <PolicyCard
          title={m.creator_shop_policies_returns_title()}
          preset={returns.preset}
          onPresetChange={(preset) => setReturns((prev) => ({ ...prev, preset }))}
        >
          <textarea
            rows={3}
            maxLength={500}
            value={returns.conditions}
            onChange={(e) => setReturns((prev) => ({ ...prev, conditions: e.target.value }))}
            placeholder={m.creator_shop_policies_returns_placeholder()}
            aria-label={m.creator_shop_policies_returns_title()}
            className='w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:border-accent-secondary focus-visible:ring-accent-secondary/20 resize-y'
          />
        </PolicyCard>

        <PolicyCard
          title={m.creator_shop_policies_exchanges_title()}
          preset={exchanges.preset}
          onPresetChange={(preset) => setExchanges((prev) => ({ ...prev, preset }))}
        >
          <textarea
            rows={3}
            maxLength={500}
            value={exchanges.conditions}
            onChange={(e) => setExchanges((prev) => ({ ...prev, conditions: e.target.value }))}
            placeholder={m.creator_shop_policies_exchanges_placeholder()}
            aria-label={m.creator_shop_policies_exchanges_title()}
            className='w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:border-accent-secondary focus-visible:ring-accent-secondary/20 resize-y'
          />
        </PolicyCard>

        <PolicyCard
          title={m.creator_shop_policies_custom_orders_title()}
          preset={custom.preset}
          onPresetChange={(preset) => setCustom((prev) => ({ ...prev, preset }))}
        >
          <textarea
            rows={3}
            maxLength={500}
            value={custom.details}
            onChange={(e) => setCustom((prev) => ({ ...prev, details: e.target.value }))}
            placeholder={m.creator_shop_policies_custom_orders_placeholder()}
            aria-label={m.creator_shop_policies_custom_orders_title()}
            className='w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:border-accent-secondary focus-visible:ring-accent-secondary/20 resize-y'
          />
        </PolicyCard>

        <div>
          <label
            htmlFor='shop-policies-additional'
            className='mb-1 block text-sm font-medium text-text-primary'
          >
            {m.creator_shop_policies_additional_label()}
          </label>
          <textarea
            id='shop-policies-additional'
            rows={4}
            maxLength={2000}
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
            placeholder={m.creator_shop_policies_additional_placeholder()}
            className='w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:border-accent-secondary focus-visible:ring-accent-secondary/20 resize-y'
          />
        </div>
      </div>
    </div>
  )
}
