import { Link } from '@tanstack/react-router'
import { Info } from 'lucide-react'
import { useCallback, useState } from 'react'
import { step5PoliciesSchema, type Policies, type ShippingOriginData } from '#/lib/sell-onboarding'
import { m } from '#/paraglide/messages'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { Textarea } from '../ui/textarea'
import { useOnboarding } from './OnboardingProvider'
import { useStepActions } from './useStepActions'

type WindowChoice = 'no' | '14' | '30' | 'custom'

interface DeliveryData {
  shippingOrigin: ShippingOriginData
  policies: Policies
}

function choiceFromPolicy(policy: {
  accepted: boolean
  windowDays?: number
  conditions?: string
}): WindowChoice {
  if (!policy.accepted) return 'no'
  if (policy.conditions) return 'custom'
  return policy.windowDays === 30 ? '30' : '14'
}

function PolicyChoice({
  legend,
  name,
  value,
  onChange,
  allowCustom = true,
}: {
  legend: string
  name: string
  value: WindowChoice
  onChange: (value: WindowChoice) => void
  allowCustom?: boolean
}) {
  const choices: Array<{ value: WindowChoice; label: string }> = [
    { value: '14', label: m.onboarding_policy_14_days() },
    { value: '30', label: m.onboarding_policy_30_days() },
    { value: 'no', label: m.onboarding_policy_not_offered() },
  ]
  if (allowCustom) choices.push({ value: 'custom', label: m.onboarding_policy_custom() })

  return (
    <fieldset>
      <legend className='font-medium text-text-primary'>{legend}</legend>
      <div className='mt-3 grid gap-2 sm:grid-cols-2'>
        {choices.map((choice) => (
          <label
            key={choice.value}
            className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-accent-secondary focus-within:ring-offset-2 ${
              value === choice.value
                ? 'border-accent-primary bg-accent-primary/10 text-text-primary'
                : 'border-border-default text-text-secondary hover:border-border-strong'
            }`}
          >
            <input
              type='radio'
              name={name}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
              className='size-5 accent-[var(--ds-accent-primary)]'
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function Step5Policies() {
  const { saveStep, getStepData, updateField } = useOnboarding()
  const form = getStepData(4) as unknown as DeliveryData
  const [errors, setErrors] = useState<Record<string, string>>({})
  const returnsChoice = choiceFromPolicy(form.policies.returns)
  const exchangesChoice = choiceFromPolicy(form.policies.exchanges)

  const updateOrigin = (fields: Partial<ShippingOriginData>) => {
    updateField(4, 'shippingOrigin', { ...form.shippingOrigin, ...fields })
  }
  const updatePolicies = (policies: Policies) => updateField(4, 'policies', policies)

  const setReturnsChoice = (choice: WindowChoice) => {
    updatePolicies({
      ...form.policies,
      returns: {
        accepted: choice !== 'no',
        windowDays: choice === '14' ? 14 : choice === '30' ? 30 : undefined,
        conditions: choice === 'custom' ? (form.policies.returns.conditions ?? '') : undefined,
      },
    })
  }
  const setExchangesChoice = (choice: WindowChoice) => {
    updatePolicies({
      ...form.policies,
      exchanges: {
        accepted: choice !== 'no',
        windowDays: choice === '14' ? 14 : choice === '30' ? 30 : undefined,
        conditions: choice === 'custom' ? (form.policies.exchanges.conditions ?? '') : undefined,
      },
    })
  }

  const validate = useCallback(() => {
    const result = step5PoliciesSchema.safeParse(form)
    if (result.success) {
      setErrors({})
      return true
    }
    const nextErrors: Record<string, string> = {}
    for (const issue of result.error.issues) nextErrors[issue.path.join('.')] = issue.message
    setErrors(nextErrors)
    const first = Object.keys(nextErrors)[0]
    const id = first.startsWith('shippingOrigin.processingTimeDays')
      ? 'processing-min'
      : first === 'policies.mandatoryRightsAcknowledged'
        ? 'mandatory-rights'
        : undefined
    if (id) document.getElementById(id)?.focus()
    return false
  }, [form])

  const save = useCallback(
    async () => saveStep(4, form as unknown as Record<string, unknown>),
    [form, saveStep],
  )
  const stepActionsRef = useStepActions(4, { validate, save })

  return (
    <div ref={stepActionsRef} className='space-y-8'>
      <header>
        <p className='text-sm font-medium text-accent-primary'>{m.onboarding_stage_delivery()}</p>
        <h1 className='display-title mt-1 text-2xl text-text-primary'>
          {m.onboarding_delivery_title()}
        </h1>
        <p className='mt-2 max-w-[65ch] text-text-secondary'>
          {m.onboarding_delivery_description()}
        </p>
      </header>

      <section className='space-y-5' aria-labelledby='processing-title'>
        <div>
          <h2 id='processing-title' className='text-lg font-semibold text-text-primary'>
            {m.onboarding_processing_title()}
          </h2>
          <p className='mt-1 text-sm text-text-secondary'>
            {m.onboarding_processing_description()}
          </p>
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div>
            <Label htmlFor='processing-min' required>
              {m.onboarding_processing_min()}
            </Label>
            <div className='mt-1 flex items-center gap-2'>
              <Input
                id='processing-min'
                type='number'
                min={1}
                max={90}
                value={form.shippingOrigin.processingTimeDays.min}
                onChange={(event) =>
                  updateOrigin({
                    processingTimeDays: {
                      ...form.shippingOrigin.processingTimeDays,
                      min: Number(event.target.value),
                    },
                  })
                }
                error={errors['shippingOrigin.processingTimeDays.min']}
              />
              <span className='shrink-0 text-sm text-text-muted'>
                {m.onboarding_business_days()}
              </span>
            </div>
          </div>
          <div>
            <Label htmlFor='processing-max' required>
              {m.onboarding_processing_max()}
            </Label>
            <div className='mt-1 flex items-center gap-2'>
              <Input
                id='processing-max'
                type='number'
                min={1}
                max={90}
                value={form.shippingOrigin.processingTimeDays.max}
                onChange={(event) =>
                  updateOrigin({
                    processingTimeDays: {
                      ...form.shippingOrigin.processingTimeDays,
                      max: Number(event.target.value),
                    },
                  })
                }
                error={errors['shippingOrigin.processingTimeDays.max']}
              />
              <span className='shrink-0 text-sm text-text-muted'>
                {m.onboarding_business_days()}
              </span>
            </div>
          </div>
        </div>
        {(errors['shippingOrigin.processingTimeDays'] ||
          errors['shippingOrigin.processingTimeDays.max']) && (
          <p id='processing-time-error' className='text-sm text-error'>
            {errors['shippingOrigin.processingTimeDays'] ??
              errors['shippingOrigin.processingTimeDays.max']}
          </p>
        )}
        <div className='flex min-h-14 items-center justify-between gap-4 rounded-xl border border-border-default p-4'>
          <div>
            <Label htmlFor='ships-international'>{m.onboarding_international_delivery()}</Label>
            <p className='mt-1 text-xs text-text-muted'>
              {m.onboarding_international_delivery_hint()}
            </p>
          </div>
          <Switch
            id='ships-international'
            checked={form.shippingOrigin.shipsInternational}
            onCheckedChange={(checked) => updateOrigin({ shipsInternational: checked })}
          />
        </div>
      </section>

      <section
        className='space-y-6 border-t border-border-default pt-8'
        aria-labelledby='policies-title'
      >
        <div>
          <h2 id='policies-title' className='text-lg font-semibold text-text-primary'>
            {m.onboarding_policies_title()}
          </h2>
          <p className='mt-1 text-sm text-text-secondary'>{m.onboarding_policies_description()}</p>
        </div>
        <div className='flex gap-3 rounded-xl border border-border-default bg-surface-inset p-4 text-sm text-text-secondary'>
          <Info className='mt-0.5 size-5 shrink-0 text-accent-primary' aria-hidden='true' />
          <p>
            {m.onboarding_mandatory_rights_notice()}{' '}
            <Link
              to='/terms'
              target='_blank'
              className='font-medium text-accent-primary hover:underline'
            >
              {m.onboarding_read_seller_terms()}
            </Link>
          </p>
        </div>

        <PolicyChoice
          legend={m.onboarding_returns()}
          name='returns-policy'
          value={returnsChoice}
          onChange={setReturnsChoice}
        />
        {returnsChoice === 'custom' && (
          <div>
            <Label htmlFor='returns-conditions'>{m.onboarding_return_conditions()}</Label>
            <Textarea
              id='returns-conditions'
              rows={3}
              maxLength={500}
              value={form.policies.returns.conditions ?? ''}
              onChange={(event) =>
                updatePolicies({
                  ...form.policies,
                  returns: {
                    ...form.policies.returns,
                    accepted: true,
                    conditions: event.target.value,
                  },
                })
              }
              className='mt-1'
            />
          </div>
        )}

        <PolicyChoice
          legend={m.onboarding_exchanges()}
          name='exchanges-policy'
          value={exchangesChoice}
          onChange={setExchangesChoice}
        />
        {exchangesChoice === 'custom' && (
          <div>
            <Label htmlFor='exchange-conditions'>{m.onboarding_exchange_conditions()}</Label>
            <Textarea
              id='exchange-conditions'
              rows={3}
              maxLength={500}
              value={form.policies.exchanges.conditions ?? ''}
              onChange={(event) =>
                updatePolicies({
                  ...form.policies,
                  exchanges: {
                    ...form.policies.exchanges,
                    accepted: true,
                    conditions: event.target.value,
                  },
                })
              }
              className='mt-1'
            />
          </div>
        )}

        <fieldset>
          <legend className='font-medium text-text-primary'>{m.onboarding_custom_orders()}</legend>
          <div className='mt-3 grid gap-2 sm:grid-cols-2'>
            {[true, false].map((accepted) => (
              <label
                key={String(accepted)}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-accent-secondary focus-within:ring-offset-2 ${form.policies.customOrders.accepted === accepted ? 'border-accent-primary bg-accent-primary/10 text-text-primary' : 'border-border-default text-text-secondary'}`}
              >
                <input
                  type='radio'
                  name='custom-orders'
                  checked={form.policies.customOrders.accepted === accepted}
                  onChange={() =>
                    updatePolicies({
                      ...form.policies,
                      customOrders: {
                        accepted,
                        details: accepted ? form.policies.customOrders.details : undefined,
                      },
                    })
                  }
                  className='size-5 accent-[var(--ds-accent-primary)]'
                />
                <span>
                  {accepted ? m.onboarding_custom_orders_yes() : m.onboarding_custom_orders_no()}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {form.policies.customOrders.accepted && (
          <div>
            <Label htmlFor='custom-order-details'>{m.onboarding_custom_order_details()}</Label>
            <Textarea
              id='custom-order-details'
              rows={3}
              maxLength={500}
              value={form.policies.customOrders.details ?? ''}
              onChange={(event) =>
                updatePolicies({
                  ...form.policies,
                  customOrders: { accepted: true, details: event.target.value },
                })
              }
              className='mt-1'
            />
          </div>
        )}

        <div>
          <Label htmlFor='additional-info'>{m.onboarding_additional_policy_info()}</Label>
          <Textarea
            id='additional-info'
            value={form.policies.additionalInfo ?? ''}
            onChange={(event) =>
              updatePolicies({ ...form.policies, additionalInfo: event.target.value || undefined })
            }
            rows={4}
            maxLength={2000}
            placeholder={m.onboarding_additional_policy_placeholder()}
            className='mt-1'
          />
        </div>

        <label
          htmlFor='mandatory-rights'
          className='flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-border-default p-4 focus-within:ring-2 focus-within:ring-accent-secondary focus-within:ring-offset-2'
        >
          <input
            id='mandatory-rights'
            type='checkbox'
            checked={form.policies.mandatoryRightsAcknowledged === true}
            onChange={(event) =>
              updatePolicies({
                ...form.policies,
                mandatoryRightsAcknowledged: event.target.checked as true,
              })
            }
            className='mt-0.5 size-5 accent-[var(--ds-accent-primary)]'
          />
          <span className='text-sm text-text-secondary'>
            {m.onboarding_rights_acknowledgement()}
          </span>
        </label>
        {errors['policies.mandatoryRightsAcknowledged'] && (
          <p id='mandatory-rights-error' className='text-sm text-error'>
            {m.onboarding_rights_required()}
          </p>
        )}
      </section>
    </div>
  )
}
