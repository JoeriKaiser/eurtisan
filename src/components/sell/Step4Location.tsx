import { Link } from '@tanstack/react-router'
import { LockKeyhole, ShieldCheck, WalletCards } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import {
  ALLOWED_COUNTRY_CODES,
  step4LocationSchema,
  type BusinessAddressData,
  type ShippingOriginData,
} from '#/lib/sell-onboarding'
import { getLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select } from '../ui/select'
import { Switch } from '../ui/switch'
import { useOnboarding } from './OnboardingProvider'
import { useStepActions } from './useStepActions'

interface SellerData {
  shippingOrigin: ShippingOriginData
  businessAddress: BusinessAddressData
  currency: 'EUR'
  isVatRegistered: boolean
  vatId: string
  legalEntityType: 'individual' | 'business'
  dateOfBirth: string
  taxId: string
  businessRegistrationNumber: string
}

function focusFirstError(errors: Record<string, string>) {
  const fieldMap: Record<string, string> = {
    'shippingOrigin.country': 'dispatch-country',
    'shippingOrigin.city': 'dispatch-city',
    'shippingOrigin.postalCode': 'dispatch-postal',
    'businessAddress.street': 'business-street',
    'businessAddress.city': 'business-city',
    'businessAddress.postalCode': 'business-postal',
    'businessAddress.country': 'business-country',
    legalEntityType: 'legal-entity-type',
    taxId: 'tax-id',
    dateOfBirth: 'date-of-birth',
    businessRegistrationNumber: 'business-registration-number',
    vatId: 'vat-id',
  }
  const id = fieldMap[Object.keys(errors)[0]]
  if (id) document.getElementById(id)?.focus()
}

export function Step4Location() {
  const { saveStep, getStepData, updateField } = useOnboarding()
  const form = getStepData(2) as unknown as SellerData
  const [errors, setErrors] = useState<Record<string, string>>({})
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([getLocale()], { type: 'region' })
    return ALLOWED_COUNTRY_CODES.map((code) => ({ code, name: names.of(code) ?? code })).sort(
      (left, right) => left.name.localeCompare(right.name),
    )
  }, [])

  const updateOrigin = (fields: Partial<ShippingOriginData>) => {
    updateField(2, 'shippingOrigin', { ...form.shippingOrigin, ...fields })
  }
  const updateAddress = (fields: Partial<BusinessAddressData>) => {
    updateField(2, 'businessAddress', { ...form.businessAddress, ...fields })
  }

  const validate = useCallback(() => {
    const result = step4LocationSchema.safeParse(form)
    if (result.success) {
      setErrors({})
      return true
    }
    const nextErrors: Record<string, string> = {}
    for (const issue of result.error.issues) nextErrors[issue.path.join('.')] = issue.message
    setErrors(nextErrors)
    focusFirstError(nextErrors)
    return false
  }, [form])

  const save = useCallback(
    async () => saveStep(2, form as unknown as Record<string, unknown>),
    [form, saveStep],
  )
  const stepActionsRef = useStepActions(2, { validate, save })
  const adultCutoff = new Date()
  adultCutoff.setFullYear(adultCutoff.getFullYear() - 18)
  const maximumBirthDate = adultCutoff.toISOString().slice(0, 10)

  return (
    <div ref={stepActionsRef} className='space-y-8'>
      <header>
        <p className='text-sm font-medium text-accent-primary'>{m.onboarding_stage_seller()}</p>
        <h1 className='display-title mt-1 text-2xl text-text-primary'>
          {m.onboarding_seller_title()}
        </h1>
        <p className='mt-2 max-w-[65ch] text-text-secondary'>{m.onboarding_seller_description()}</p>
      </header>

      <section
        className='grid gap-3 rounded-xl border border-border-default bg-surface-inset p-4 sm:grid-cols-3'
        aria-label={m.onboarding_launch_requirements()}
      >
        <div className='flex gap-3'>
          <ShieldCheck className='size-5 shrink-0 text-accent-primary' aria-hidden='true' />
          <div>
            <p className='text-sm font-semibold text-text-primary'>
              {m.onboarding_review_requirement()}
            </p>
            <p className='mt-1 text-xs text-text-muted'>{m.onboarding_review_requirement_hint()}</p>
          </div>
        </div>
        <div className='flex gap-3'>
          <LockKeyhole className='size-5 shrink-0 text-accent-primary' aria-hidden='true' />
          <div>
            <p className='text-sm font-semibold text-text-primary'>
              {m.onboarding_2fa_requirement()}
            </p>
            <p className='mt-1 text-xs text-text-muted'>{m.onboarding_2fa_requirement_hint()}</p>
          </div>
        </div>
        <div className='flex gap-3'>
          <WalletCards className='size-5 shrink-0 text-accent-primary' aria-hidden='true' />
          <div>
            <p className='text-sm font-semibold text-text-primary'>
              {m.onboarding_payment_requirement()}
            </p>
            <p className='mt-1 text-xs text-text-muted'>
              {m.onboarding_payment_requirement_hint()}
            </p>
          </div>
        </div>
      </section>

      <section className='space-y-5' aria-labelledby='dispatch-title'>
        <div>
          <h2 id='dispatch-title' className='text-lg font-semibold text-text-primary'>
            {m.onboarding_dispatch_title()}
          </h2>
          <p className='mt-1 text-sm text-text-secondary'>{m.onboarding_dispatch_description()}</p>
        </div>
        <div>
          <Label htmlFor='dispatch-country' required>
            {m.onboarding_country()}
          </Label>
          <Select
            id='dispatch-country'
            value={form.shippingOrigin.country}
            onChange={(event) => {
              const country = event.target.value
              updateOrigin({ country })
              if (!form.businessAddress.country) updateAddress({ country })
            }}
            className='mt-1'
            error={errors['shippingOrigin.country']}
          >
            <option value=''>{m.onboarding_country_placeholder()}</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </Select>
          {errors['shippingOrigin.country'] && (
            <p id='dispatch-country-error' className='mt-1 text-sm text-error'>
              {errors['shippingOrigin.country']}
            </p>
          )}
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div>
            <Label htmlFor='dispatch-city' required>
              {m.onboarding_city()}
            </Label>
            <Input
              id='dispatch-city'
              value={form.shippingOrigin.city ?? ''}
              onChange={(event) => updateOrigin({ city: event.target.value })}
              placeholder={m.onboarding_city_placeholder()}
              className='mt-1'
              error={errors['shippingOrigin.city']}
            />
            {errors['shippingOrigin.city'] && (
              <p id='dispatch-city-error' className='mt-1 text-sm text-error'>
                {errors['shippingOrigin.city']}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor='dispatch-postal' required>
              {m.onboarding_postal_code()}
            </Label>
            <Input
              id='dispatch-postal'
              value={form.shippingOrigin.postalCode ?? ''}
              onChange={(event) => updateOrigin({ postalCode: event.target.value })}
              placeholder={m.onboarding_postal_placeholder()}
              className='mt-1'
              error={errors['shippingOrigin.postalCode']}
            />
            {errors['shippingOrigin.postalCode'] && (
              <p id='dispatch-postal-error' className='mt-1 text-sm text-error'>
                {errors['shippingOrigin.postalCode']}
              </p>
            )}
          </div>
        </div>
      </section>

      <section
        className='space-y-5 border-t border-border-default pt-8'
        aria-labelledby='legal-address-title'
      >
        <div>
          <h2 id='legal-address-title' className='text-lg font-semibold text-text-primary'>
            {m.onboarding_legal_address_title()}
          </h2>
          <p className='mt-1 text-sm text-text-secondary'>
            {m.onboarding_legal_address_description()}
          </p>
        </div>
        <div>
          <Label htmlFor='business-street' required>
            {m.onboarding_street()}
          </Label>
          <Input
            id='business-street'
            value={form.businessAddress.street}
            onChange={(event) => updateAddress({ street: event.target.value })}
            placeholder={m.onboarding_street_placeholder()}
            className='mt-1'
            error={errors['businessAddress.street']}
          />
          {errors['businessAddress.street'] && (
            <p id='business-street-error' className='mt-1 text-sm text-error'>
              {errors['businessAddress.street']}
            </p>
          )}
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div>
            <Label htmlFor='business-city' required>
              {m.onboarding_city()}
            </Label>
            <Input
              id='business-city'
              value={form.businessAddress.city}
              onChange={(event) => updateAddress({ city: event.target.value })}
              className='mt-1'
              error={errors['businessAddress.city']}
            />
            {errors['businessAddress.city'] && (
              <p id='business-city-error' className='mt-1 text-sm text-error'>
                {errors['businessAddress.city']}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor='business-postal' required>
              {m.onboarding_postal_code()}
            </Label>
            <Input
              id='business-postal'
              value={form.businessAddress.postalCode}
              onChange={(event) => updateAddress({ postalCode: event.target.value })}
              className='mt-1'
              error={errors['businessAddress.postalCode']}
            />
            {errors['businessAddress.postalCode'] && (
              <p id='business-postal-error' className='mt-1 text-sm text-error'>
                {errors['businessAddress.postalCode']}
              </p>
            )}
          </div>
        </div>
        <div>
          <Label htmlFor='business-country' required>
            {m.onboarding_country()}
          </Label>
          <Select
            id='business-country'
            value={form.businessAddress.country}
            onChange={(event) => updateAddress({ country: event.target.value })}
            className='mt-1'
            error={errors['businessAddress.country']}
          >
            <option value=''>{m.onboarding_country_placeholder()}</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </Select>
          {errors['businessAddress.country'] && (
            <p id='business-country-error' className='mt-1 text-sm text-error'>
              {errors['businessAddress.country']}
            </p>
          )}
        </div>
      </section>

      <section
        className='space-y-5 border-t border-border-default pt-8'
        aria-labelledby='tax-title'
      >
        <div>
          <h2 id='tax-title' className='text-lg font-semibold text-text-primary'>
            {m.onboarding_tax_title()}
          </h2>
          <p className='mt-1 text-sm text-text-secondary'>{m.onboarding_tax_description()}</p>
          <Link
            to='/privacy'
            target='_blank'
            className='mt-2 inline-flex min-h-11 items-center text-sm font-medium text-accent-primary hover:underline'
          >
            {m.onboarding_privacy_link()}
          </Link>
        </div>
        <div>
          <Label htmlFor='legal-entity-type' required>
            {m.onboarding_entity_type()}
          </Label>
          <Select
            id='legal-entity-type'
            value={form.legalEntityType}
            onChange={(event) => updateField(2, 'legalEntityType', event.target.value)}
            className='mt-1'
            error={errors.legalEntityType}
          >
            <option value='individual'>{m.onboarding_entity_individual()}</option>
            <option value='business'>{m.onboarding_entity_business()}</option>
          </Select>
          {errors.legalEntityType && (
            <p id='legal-entity-type-error' className='mt-1 text-sm text-error'>
              {errors.legalEntityType}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor='tax-id' required>
            {m.onboarding_tax_id()}
          </Label>
          <Input
            id='tax-id'
            value={form.taxId}
            onChange={(event) => updateField(2, 'taxId', event.target.value)}
            placeholder={m.onboarding_tax_id_placeholder()}
            className='mt-1'
            error={errors.taxId}
          />
          {errors.taxId ? (
            <p id='tax-id-error' className='mt-1 text-sm text-error'>
              {errors.taxId}
            </p>
          ) : (
            <p className='mt-1 text-xs text-text-muted'>
              {m.onboarding_tax_id_hint({
                country: form.shippingOrigin.country || m.onboarding_selected_country(),
              })}
            </p>
          )}
        </div>
        {form.legalEntityType === 'individual' ? (
          <div>
            <Label htmlFor='date-of-birth' required>
              {m.onboarding_birth_date()}
            </Label>
            <Input
              id='date-of-birth'
              type='date'
              max={maximumBirthDate}
              value={form.dateOfBirth}
              onChange={(event) => updateField(2, 'dateOfBirth', event.target.value)}
              className='mt-1'
              error={errors.dateOfBirth}
            />
            {errors.dateOfBirth && (
              <p id='date-of-birth-error' className='mt-1 text-sm text-error'>
                {errors.dateOfBirth}
              </p>
            )}
          </div>
        ) : (
          <div>
            <Label htmlFor='business-registration-number' required>
              {m.onboarding_registration_number()}
            </Label>
            <Input
              id='business-registration-number'
              value={form.businessRegistrationNumber}
              onChange={(event) => updateField(2, 'businessRegistrationNumber', event.target.value)}
              placeholder={m.onboarding_registration_placeholder()}
              className='mt-1'
              error={errors.businessRegistrationNumber}
            />
            {errors.businessRegistrationNumber && (
              <p id='business-registration-number-error' className='mt-1 text-sm text-error'>
                {errors.businessRegistrationNumber}
              </p>
            )}
          </div>
        )}

        <div className='rounded-xl border border-border-default p-4'>
          <div className='flex min-h-11 items-center justify-between gap-4'>
            <div>
              <Label htmlFor='is-vat-registered'>{m.onboarding_vat_registered()}</Label>
              <p className='mt-1 text-xs text-text-muted'>{m.onboarding_vat_registered_hint()}</p>
            </div>
            <Switch
              id='is-vat-registered'
              checked={form.isVatRegistered}
              onCheckedChange={(checked) => updateField(2, 'isVatRegistered', checked)}
            />
          </div>
          {form.isVatRegistered && (
            <div className='mt-4'>
              <Label htmlFor='vat-id' required>
                {m.onboarding_vat_id()}
              </Label>
              <Input
                id='vat-id'
                value={form.vatId}
                onChange={(event) => updateField(2, 'vatId', event.target.value)}
                placeholder={m.onboarding_vat_placeholder()}
                className='mt-1'
                error={errors.vatId}
              />
              {errors.vatId && (
                <p id='vat-id-error' className='mt-1 text-sm text-error'>
                  {errors.vatId}
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
