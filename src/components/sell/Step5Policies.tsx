import { useCallback, useState } from 'react'
import { step5PoliciesSchema } from '#/lib/sell-onboarding'
import { Textarea } from '../ui/textarea'
import { useOnboarding } from './OnboardingProvider'
import { useStepActions } from './useStepActions'

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
      <h3 className='mb-3 font-medium text-text-primary'>{title}</h3>
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

export function Step5Policies() {
  const { saveStep, getStepData } = useOnboarding()
  const data = getStepData(5) as {
    policies: {
      returns: { accepted: boolean; windowDays?: number; conditions?: string }
      exchanges: { accepted: boolean; conditions?: string }
      customOrders: { accepted: boolean; details?: string }
      paymentMethods: string[]
      additionalInfo?: string
    }
  }

  const [returns, setReturns] = useState({
    preset: (data.policies?.returns?.accepted
      ? data.policies.returns.windowDays === 14
        ? 'yes14'
        : data.policies.returns.windowDays === 30
          ? 'yes30'
          : 'custom'
      : 'no') as PolicyPreset,
    conditions: data.policies?.returns?.conditions ?? '',
  })

  const [exchanges, setExchanges] = useState({
    preset: (data.policies?.exchanges?.accepted
      ? data.policies.exchanges.conditions
        ? 'custom'
        : 'yes14'
      : 'no') as PolicyPreset,
    conditions: data.policies?.exchanges?.conditions ?? '',
  })

  const [custom, setCustom] = useState({
    preset: (data.policies?.customOrders?.accepted
      ? data.policies.customOrders.details
        ? 'custom'
        : 'yes14'
      : 'no') as PolicyPreset,
    details: data.policies?.customOrders?.details ?? '',
  })

  const [additionalInfo, setAdditionalInfo] = useState(data.policies?.additionalInfo ?? '')

  const buildPolicies = useCallback(
    () => ({
      returns: {
        accepted: returns.preset !== 'no',
        windowDays: returns.preset === 'yes14' ? 14 : returns.preset === 'yes30' ? 30 : undefined,
        conditions: returns.preset === 'custom' ? returns.conditions : undefined,
      },
      exchanges: {
        accepted: exchanges.preset !== 'no',
        conditions: exchanges.preset === 'custom' ? exchanges.conditions : undefined,
      },
      customOrders: {
        accepted: custom.preset !== 'no',
        details: custom.preset === 'custom' ? custom.details : undefined,
      },
      paymentMethods: data.policies?.paymentMethods ?? [],
      additionalInfo: additionalInfo || undefined,
    }),
    [returns, exchanges, custom, additionalInfo, data.policies],
  )

  const validate = useCallback(() => {
    const result = step5PoliciesSchema.safeParse({ policies: buildPolicies() })
    return result.success
  }, [buildPolicies])

  const save = useCallback(async () => {
    await saveStep(5, { policies: buildPolicies() })
  }, [saveStep, buildPolicies])

  useStepActions(5, { validate, save })

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='display-title text-2xl text-text-primary'>Shop Policies</h2>
        <p className='mt-1 text-text-secondary'>
          Set expectations: buyers trust shops that are upfront.
        </p>
      </div>

      <div className='rounded-lg border border-accent-secondary/20 bg-accent-secondary-subtle/30 p-3 text-sm text-accent-secondary'>
        You can always update your policies later from your shop settings.
      </div>

      <PolicyCard
        title='Returns'
        preset={returns.preset}
        onPresetChange={(preset) => setReturns((prev) => ({ ...prev, preset }))}
      >
        <Textarea
          value={returns.conditions}
          onChange={(e) => setReturns((prev) => ({ ...prev, conditions: e.target.value }))}
          rows={3}
          maxLength={500}
          placeholder='Describe your return conditions...'
        />
      </PolicyCard>

      <PolicyCard
        title='Exchanges'
        preset={exchanges.preset}
        onPresetChange={(preset) => setExchanges((prev) => ({ ...prev, preset }))}
      >
        <Textarea
          value={exchanges.conditions}
          onChange={(e) => setExchanges((prev) => ({ ...prev, conditions: e.target.value }))}
          rows={3}
          maxLength={500}
          placeholder='Describe your exchange conditions...'
        />
      </PolicyCard>

      <PolicyCard
        title='Custom orders'
        preset={custom.preset}
        onPresetChange={(preset) => setCustom((prev) => ({ ...prev, preset }))}
      >
        <Textarea
          value={custom.details}
          onChange={(e) => setCustom((prev) => ({ ...prev, details: e.target.value }))}
          rows={3}
          maxLength={500}
          placeholder='Describe how you handle custom orders...'
        />
      </PolicyCard>

      <div>
        <label
          htmlFor='additional-info'
          className='mb-1 block text-sm font-medium text-text-primary'
        >
          Additional policy info (optional)
        </label>
        <Textarea
          id='additional-info'
          value={additionalInfo}
          onChange={(e) => setAdditionalInfo(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder='Care instructions, sizing notes, etc.'
        />
      </div>
    </div>
  )
}
