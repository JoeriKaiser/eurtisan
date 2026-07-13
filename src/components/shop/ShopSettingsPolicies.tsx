import { useState } from 'react'
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

  const commit = (
    nextReturns = returns,
    nextExchanges = exchanges,
    nextCustom = custom,
    nextAdditionalInfo = additionalInfo,
  ) => {
    const hasReturns = nextReturns.preset !== 'no'
    const hasExchanges = nextExchanges.preset !== 'no'
    const hasCustom = nextCustom.preset !== 'no'

    if (!hasReturns && !hasExchanges && !hasCustom && !nextAdditionalInfo.trim()) {
      onChange(null)
      return
    }

    onChange({
      returns: {
        accepted: hasReturns,
        windowDays:
          nextReturns.preset === 'yes14' ? 14 : nextReturns.preset === 'yes30' ? 30 : undefined,
        conditions: nextReturns.preset === 'custom' ? nextReturns.conditions : undefined,
      },
      exchanges: {
        accepted: hasExchanges,
        conditions: nextExchanges.preset === 'custom' ? nextExchanges.conditions : undefined,
      },
      customOrders: {
        accepted: hasCustom,
        details: nextCustom.preset === 'custom' ? nextCustom.details : undefined,
      },
      paymentMethods: policies?.paymentMethods ?? [],
      additionalInfo: nextAdditionalInfo.trim() || undefined,
    })
  }

  const updateReturns = (next: typeof returns) => {
    setReturns(next)
    commit(next)
  }
  const updateExchanges = (next: typeof exchanges) => {
    setExchanges(next)
    commit(returns, next)
  }
  const updateCustom = (next: typeof custom) => {
    setCustom(next)
    commit(returns, exchanges, next)
  }
  const updateAdditionalInfo = (next: string) => {
    setAdditionalInfo(next)
    commit(returns, exchanges, custom, next)
  }

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
          onPresetChange={(preset) => updateReturns({ ...returns, preset })}
        >
          <textarea
            rows={3}
            maxLength={500}
            value={returns.conditions}
            onChange={(e) => updateReturns({ ...returns, conditions: e.target.value })}
            placeholder={m.creator_shop_policies_returns_placeholder()}
            aria-label={m.creator_shop_policies_returns_title()}
            className='w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:border-accent-secondary focus-visible:ring-accent-secondary/20 resize-y'
          />
        </PolicyCard>

        <PolicyCard
          title={m.creator_shop_policies_exchanges_title()}
          preset={exchanges.preset}
          onPresetChange={(preset) => updateExchanges({ ...exchanges, preset })}
        >
          <textarea
            rows={3}
            maxLength={500}
            value={exchanges.conditions}
            onChange={(e) => updateExchanges({ ...exchanges, conditions: e.target.value })}
            placeholder={m.creator_shop_policies_exchanges_placeholder()}
            aria-label={m.creator_shop_policies_exchanges_title()}
            className='w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:border-accent-secondary focus-visible:ring-accent-secondary/20 resize-y'
          />
        </PolicyCard>

        <PolicyCard
          title={m.creator_shop_policies_custom_orders_title()}
          preset={custom.preset}
          onPresetChange={(preset) => updateCustom({ ...custom, preset })}
        >
          <textarea
            rows={3}
            maxLength={500}
            value={custom.details}
            onChange={(e) => updateCustom({ ...custom, details: e.target.value })}
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
            onChange={(e) => updateAdditionalInfo(e.target.value)}
            placeholder={m.creator_shop_policies_additional_placeholder()}
            className='w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:border-accent-secondary focus-visible:ring-accent-secondary/20 resize-y'
          />
        </div>
      </div>
    </div>
  )
}
