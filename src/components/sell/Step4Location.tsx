import { useCallback, useMemo, useState } from 'react'
import { step4LocationSchema } from '#/lib/sell-onboarding'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select } from '../ui/select'
import { Switch } from '../ui/switch'
import { useOnboarding } from './OnboardingProvider'
import { useStepActions } from './useStepActions'

const COUNTRIES = [
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'AT', name: 'Austria' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PL', name: 'Poland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'NO', name: 'Norway' },
]

const COUNTRY_CURRENCIES: Record<string, string> = {
  FR: 'EUR',
  DE: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  PT: 'EUR',
  IE: 'EUR',
  FI: 'EUR',
  PL: 'PLN',
  SE: 'SEK',
  DK: 'DKK',
  CH: 'CHF',
  NO: 'NOK',
  GB: 'GBP',
  US: 'USD',
  CA: 'CAD',
  AU: 'AUD',
}

const STATES_US = [
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
]
const PROVINCES_CA = [
  'Alberta',
  'British Columbia',
  'Manitoba',
  'New Brunswick',
  'Newfoundland and Labrador',
  'Nova Scotia',
  'Ontario',
  'Prince Edward Island',
  'Quebec',
  'Saskatchewan',
]
const STATES_AU = [
  'Australian Capital Territory',
  'New South Wales',
  'Northern Territory',
  'Queensland',
  'South Australia',
  'Tasmania',
  'Victoria',
  'Western Australia',
]

export function Step4Location() {
  const { saveStep, getStepData } = useOnboarding()
  const data = getStepData(4) as {
    shippingOrigin: {
      country: string
      state?: string
      city?: string
      postalCode?: string
      processingTimeDays: { min: number; max: number }
      shipsInternational: boolean
    }
    currency: string
    isVatRegistered?: boolean
    vatId?: string | null
    legalEntityType?: 'individual' | 'business'
    dateOfBirth?: string | null
    taxId?: string | null
    businessRegistrationNumber?: string | null
  }

  const [form, setForm] = useState({
    country: data.shippingOrigin?.country ?? '',
    state: data.shippingOrigin?.state ?? '',
    city: data.shippingOrigin?.city ?? '',
    postalCode: data.shippingOrigin?.postalCode ?? '',
    processingMin: data.shippingOrigin?.processingTimeDays?.min ?? 1,
    processingMax: data.shippingOrigin?.processingTimeDays?.max ?? 3,
    shipsInternational: data.shippingOrigin?.shipsInternational ?? false,
    currency: data.currency ?? 'EUR',
    isVatRegistered: data.isVatRegistered ?? false,
    vatId: data.vatId ?? '',
    legalEntityType: data.legalEntityType ?? 'individual',
    dateOfBirth: data.dateOfBirth ?? '',
    taxId: data.taxId ?? '',
    businessRegistrationNumber: data.businessRegistrationNumber ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const stateOptions = useMemo(() => {
    if (form.country === 'US') return STATES_US
    if (form.country === 'CA') return PROVINCES_CA
    if (form.country === 'AU') return STATES_AU
    return []
  }, [form.country])

  const handleCountryChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      country: value,
      state: '',
      currency: COUNTRY_CURRENCIES[value] ?? 'EUR',
    }))
  }

  const validate = useCallback(() => {
    const result = step4LocationSchema.safeParse({
      shippingOrigin: {
        country: form.country,
        state: form.state || undefined,
        city: form.city || undefined,
        postalCode: form.postalCode || undefined,
        processingTimeDays: { min: form.processingMin, max: form.processingMax },
        shipsInternational: form.shipsInternational,
      },
      currency: form.currency,
      isVatRegistered: form.isVatRegistered,
      vatId: form.vatId,
      legalEntityType: form.legalEntityType,
      dateOfBirth: form.dateOfBirth,
      taxId: form.taxId,
      businessRegistrationNumber: form.businessRegistrationNumber,
    })
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path.join('.')
        fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return false
    }
    setErrors({})
    return true
  }, [form])

  const save = useCallback(async () => {
    await saveStep(4, {
      shippingOrigin: {
        country: form.country,
        state: form.state || undefined,
        city: form.city || undefined,
        postalCode: form.postalCode || undefined,
        processingTimeDays: { min: form.processingMin, max: form.processingMax },
        shipsInternational: form.shipsInternational,
      },
      currency: form.currency,
      isVatRegistered: form.isVatRegistered,
      vatId: form.vatId,
      legalEntityType: form.legalEntityType,
      dateOfBirth: form.dateOfBirth,
      taxId: form.taxId,
      businessRegistrationNumber: form.businessRegistrationNumber,
    })
  }, [form, saveStep])

  useStepActions(4, { validate, save })

  return (
    <div className='space-y-6'>
      <div>
        <h2 className='display-title text-2xl text-text-primary'>Location & Shipping</h2>
        <p className='mt-1 text-text-secondary'>Where are your items coming from?</p>
      </div>

      <div>
        <Label htmlFor='country' required>
          Country
        </Label>
        <Select
          id='country'
          value={form.country}
          onChange={(e) => handleCountryChange(e.target.value)}
          className='mt-1'
        >
          <option value=''>Select a country</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
        {errors['shippingOrigin.country'] && (
          <p className='mt-1 text-sm text-error'>{errors['shippingOrigin.country']}</p>
        )}
      </div>

      {stateOptions.length > 0 && (
        <div>
          <Label htmlFor='state'>State / Province</Label>
          <Select
            id='state'
            value={form.state}
            onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
            className='mt-1'
          >
            <option value=''>Select…</option>
            {stateOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className='grid gap-4 sm:grid-cols-2'>
        <div>
          <Label htmlFor='city'>City</Label>
          <Input
            id='city'
            value={form.city}
            onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
            placeholder='e.g. Paris'
            className='mt-1'
          />
        </div>
        <div>
          <Label htmlFor='postal'>Postal code</Label>
          <Input
            id='postal'
            value={form.postalCode}
            onChange={(e) => setForm((prev) => ({ ...prev, postalCode: e.target.value }))}
            placeholder='e.g. 75001'
            className='mt-1'
          />
        </div>
      </div>

      <div>
        <Label required>Processing time</Label>
        <div className='mt-1 flex items-center gap-2'>
          <span className='text-sm text-text-secondary'>Ships within</span>
          <Input
            type='number'
            min={1}
            max={90}
            value={form.processingMin}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, processingMin: Number(e.target.value) }))
            }
            className='w-20'
          />
          <span className='text-sm text-text-secondary'>–</span>
          <Input
            type='number'
            min={1}
            max={90}
            value={form.processingMax}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, processingMax: Number(e.target.value) }))
            }
            className='w-20'
          />
          <span className='text-sm text-text-secondary'>business days</span>
        </div>
        {errors['shippingOrigin.processingTimeDays'] && (
          <p className='mt-1 text-sm text-error'>{errors['shippingOrigin.processingTimeDays']}</p>
        )}
      </div>

      <div className='rounded-xl border border-border-default p-4'>
        <div className='flex items-center justify-between'>
          <Label htmlFor='ships-international'>Ships internationally</Label>
          <Switch
            id='ships-international'
            checked={form.shipsInternational}
            onCheckedChange={(checked) =>
              setForm((prev) => ({ ...prev, shipsInternational: checked }))
            }
          />
        </div>
      </div>

      <div>
        <Label htmlFor='currency' required>
          Default currency
        </Label>
        <Select
          id='currency'
          value={form.currency}
          onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
          className='mt-1'
        >
          <option value='EUR'>EUR: Euro</option>
          <option value='USD'>USD: US Dollar</option>
          <option value='GBP'>GBP: British Pound</option>
          <option value='CAD'>CAD: Canadian Dollar</option>
          <option value='AUD'>AUD: Australian Dollar</option>
          <option value='CHF'>CHF: Swiss Franc</option>
          <option value='SEK'>SEK: Swedish Krona</option>
          <option value='NOK'>NOK: Norwegian Krone</option>
          <option value='DKK'>DKK: Danish Krone</option>
          <option value='PLN'>PLN: Polish Zloty</option>
        </Select>
      </div>

      <div className='border-t border-border-default pt-6 space-y-4'>
        <div>
          <h3 className='text-sm font-semibold text-text-primary uppercase tracking-wider mb-2'>
            Tax Settings
          </h3>
          <p className='text-xs text-text-secondary mb-4'>
            If you are registered for VAT in the European Union, please enable this and enter your
            VAT Identification Number.
          </p>
        </div>

        <div className='flex items-center justify-between rounded-xl border border-border-default p-4'>
          <div>
            <Label htmlFor='is-vat-registered' className='font-semibold'>
              Registered for VAT
            </Label>
            <p className='text-xs text-text-secondary mt-0.5'>
              I have a registered VAT number for my business.
            </p>
          </div>
          <Switch
            id='is-vat-registered'
            checked={form.isVatRegistered}
            onCheckedChange={(checked) =>
              setForm((prev) => ({ ...prev, isVatRegistered: checked }))
            }
          />
        </div>

        {form.isVatRegistered && (
          <div className='space-y-1.5 transition-all duration-200'>
            <Label htmlFor='vat-id' required>
              VAT ID / Identification Number
            </Label>
            <Input
              id='vat-id'
              value={form.vatId}
              onChange={(e) => setForm((prev) => ({ ...prev, vatId: e.target.value }))}
              placeholder='e.g. FR12345678901'
              className='mt-1'
            />
            {errors.vatId && <p className='mt-1 text-sm text-error'>{errors.vatId}</p>}
          </div>
        )}
      </div>

      <div className='border-t border-border-default pt-6 space-y-4'>
        <div>
          <h3 className='text-sm font-semibold text-text-primary uppercase tracking-wider mb-2'>
            Tax Identity & DAC7 Compliance
          </h3>
          <p className='text-xs text-text-secondary mb-4'>
            In accordance with European Union DAC7 regulations, Eurtisan is required to collect and
            verify tax identity information for all sellers.
          </p>
        </div>

        <div>
          <Label htmlFor='legal-entity-type' required>
            Legal Entity Type
          </Label>
          <Select
            id='legal-entity-type'
            value={form.legalEntityType}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                legalEntityType: e.target.value as 'individual' | 'business',
              }))
            }
            className='mt-1'
          >
            <option value='individual'>Individual / Sole Proprietor</option>
            <option value='business'>Registered Business / Corporation</option>
          </Select>
          {errors.legalEntityType && (
            <p className='mt-1 text-sm text-error'>{errors.legalEntityType}</p>
          )}
        </div>

        <div>
          <Label htmlFor='tax-id' required>
            Tax Identification Number (TIN)
          </Label>
          <Input
            id='tax-id'
            value={form.taxId}
            onChange={(e) => setForm((prev) => ({ ...prev, taxId: e.target.value }))}
            placeholder='TIN required for EU tax reporting'
            className='mt-1'
          />
          {errors.taxId && <p className='mt-1 text-sm text-error'>{errors.taxId}</p>}
        </div>

        {form.legalEntityType === 'individual' && (
          <div className='space-y-1.5'>
            <Label htmlFor='date-of-birth' required>
              Date of Birth
            </Label>
            <Input
              id='date-of-birth'
              type='date'
              value={form.dateOfBirth}
              onChange={(e) => setForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
              className='mt-1'
            />
            {errors.dateOfBirth && <p className='mt-1 text-sm text-error'>{errors.dateOfBirth}</p>}
          </div>
        )}

        {form.legalEntityType === 'business' && (
          <div className='space-y-1.5'>
            <Label htmlFor='business-registration-number' required>
              Business Registration Number
            </Label>
            <Input
              id='business-registration-number'
              value={form.businessRegistrationNumber}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, businessRegistrationNumber: e.target.value }))
              }
              placeholder='e.g. SIRET or Trade Registry Number'
              className='mt-1'
            />
            {errors.businessRegistrationNumber && (
              <p className='mt-1 text-sm text-error'>{errors.businessRegistrationNumber}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
