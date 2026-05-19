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
  }

  const [country, setCountry] = useState(data.shippingOrigin?.country ?? '')
  const [state, setState] = useState(data.shippingOrigin?.state ?? '')
  const [city, setCity] = useState(data.shippingOrigin?.city ?? '')
  const [postalCode, setPostalCode] = useState(data.shippingOrigin?.postalCode ?? '')
  const [processingMin, setProcessingMin] = useState(
    data.shippingOrigin?.processingTimeDays?.min ?? 1,
  )
  const [processingMax, setProcessingMax] = useState(
    data.shippingOrigin?.processingTimeDays?.max ?? 3,
  )
  const [shipsInternational, setShipsInternational] = useState(
    data.shippingOrigin?.shipsInternational ?? false,
  )
  const [currency, setCurrency] = useState(data.currency ?? 'EUR')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const stateOptions = useMemo(() => {
    if (country === 'US') return STATES_US
    if (country === 'CA') return PROVINCES_CA
    if (country === 'AU') return STATES_AU
    return []
  }, [country])

  const handleCountryChange = (value: string) => {
    setCountry(value)
    setState('')
    const newCurrency = COUNTRY_CURRENCIES[value] ?? 'EUR'
    setCurrency(newCurrency)
  }

  const validate = useCallback(() => {
    const result = step4LocationSchema.safeParse({
      shippingOrigin: {
        country,
        state: state || undefined,
        city: city || undefined,
        postalCode: postalCode || undefined,
        processingTimeDays: { min: processingMin, max: processingMax },
        shipsInternational,
      },
      currency,
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
  }, [country, state, city, postalCode, processingMin, processingMax, shipsInternational, currency])

  const save = useCallback(async () => {
    await saveStep(4, {
      shippingOrigin: {
        country,
        state: state || undefined,
        city: city || undefined,
        postalCode: postalCode || undefined,
        processingTimeDays: { min: processingMin, max: processingMax },
        shipsInternational,
      },
      currency,
    })
  }, [
    country,
    state,
    city,
    postalCode,
    processingMin,
    processingMax,
    shipsInternational,
    currency,
    saveStep,
  ])

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
          value={country}
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
            value={state}
            onChange={(e) => setState(e.target.value)}
            className='mt-1'
          >
            <option value=''>Select...</option>
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
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder='e.g. Paris'
            className='mt-1'
          />
        </div>
        <div>
          <Label htmlFor='postal'>Postal code</Label>
          <Input
            id='postal'
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
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
            value={processingMin}
            onChange={(e) => setProcessingMin(Number(e.target.value))}
            className='w-20'
          />
          <span className='text-sm text-text-secondary'>–</span>
          <Input
            type='number'
            min={1}
            max={90}
            value={processingMax}
            onChange={(e) => setProcessingMax(Number(e.target.value))}
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
            checked={shipsInternational}
            onCheckedChange={setShipsInternational}
          />
        </div>
      </div>

      <div>
        <Label htmlFor='currency' required>
          Default currency
        </Label>
        <Select
          id='currency'
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className='mt-1'
        >
          <option value='EUR'>EUR — Euro</option>
          <option value='USD'>USD — US Dollar</option>
          <option value='GBP'>GBP — British Pound</option>
          <option value='CAD'>CAD — Canadian Dollar</option>
          <option value='AUD'>AUD — Australian Dollar</option>
          <option value='CHF'>CHF — Swiss Franc</option>
          <option value='SEK'>SEK — Swedish Krona</option>
          <option value='NOK'>NOK — Norwegian Krone</option>
          <option value='DKK'>DKK — Danish Krone</option>
          <option value='PLN'>PLN — Polish Zloty</option>
        </Select>
      </div>
    </div>
  )
}
