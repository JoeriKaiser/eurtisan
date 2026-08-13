import { Input } from '#/components/ui/input'
import { m } from '#/paraglide/messages'

interface ShopSettingsTaxIdentityProps {
  legalEntityType: 'individual' | 'business' | ''
  dateOfBirth: string
  taxId: string
  businessRegistrationNumber: string
  taxIdError: string | null
  dateOfBirthError: string | null
  businessRegistrationNumberError: string | null
  onLegalEntityTypeChange: (value: 'individual' | 'business') => void
  onDateOfBirthChange: (value: string) => void
  onTaxIdChange: (value: string) => void
  onBusinessRegistrationNumberChange: (value: string) => void
  onFieldErrorClear: (field: 'taxId' | 'dateOfBirth' | 'businessRegistrationNumber') => void
}

export function ShopSettingsTaxIdentity({
  legalEntityType,
  dateOfBirth,
  taxId,
  businessRegistrationNumber,
  taxIdError,
  dateOfBirthError,
  businessRegistrationNumberError,
  onLegalEntityTypeChange,
  onDateOfBirthChange,
  onTaxIdChange,
  onBusinessRegistrationNumberChange,
  onFieldErrorClear,
}: ShopSettingsTaxIdentityProps) {
  return (
    <div className='rounded-xl border border-border-subtle p-4'>
      <h3 className='mb-3 text-sm font-semibold text-text-primary'>
        {m.shop_settings_tax_identity_title()}
      </h3>
      <p className='mb-3 text-xs text-text-muted'>{m.shop_settings_tax_identity_description()}</p>
      <div className='space-y-4'>
        <div>
          <span className='mb-1.5 block text-xs font-medium text-text-secondary'>
            {m.shop_settings_legal_entity_type_label()}
          </span>
          <div className='flex gap-4'>
            <label className='flex items-center gap-2 text-sm text-text-secondary'>
              <input
                type='radio'
                name='legalEntityType'
                value='individual'
                checked={legalEntityType === 'individual'}
                onChange={() => onLegalEntityTypeChange('individual')}
                className='h-4 w-4 accent-accent-primary'
              />
              {m.shop_settings_legal_entity_individual()}
            </label>
            <label className='flex items-center gap-2 text-sm text-text-secondary'>
              <input
                type='radio'
                name='legalEntityType'
                value='business'
                checked={legalEntityType === 'business'}
                onChange={() => onLegalEntityTypeChange('business')}
                className='h-4 w-4 accent-accent-primary'
              />
              {m.shop_settings_legal_entity_business()}
            </label>
          </div>
        </div>

        <div>
          <label htmlFor='tax-id' className='mb-1.5 block text-xs font-medium text-text-secondary'>
            {m.shop_settings_tax_id_label()}
          </label>
          <Input
            id='tax-id'
            type='text'
            value={taxId}
            onChange={(e) => {
              onTaxIdChange(e.target.value)
              if (taxIdError) onFieldErrorClear('taxId')
            }}
            placeholder={m.shop_settings_tax_id_placeholder()}
            error={taxIdError ?? undefined}
          />
          {taxIdError && (
            <p id='tax-id-error' className='mt-1 text-sm text-error'>
              {taxIdError}
            </p>
          )}
        </div>

        {legalEntityType === 'individual' && (
          <div>
            <label
              htmlFor='date-of-birth'
              className='mb-1.5 block text-xs font-medium text-text-secondary'
            >
              {m.shop_settings_date_of_birth_label()}
            </label>
            <Input
              id='date-of-birth'
              type='date'
              value={dateOfBirth}
              onChange={(e) => {
                onDateOfBirthChange(e.target.value)
                if (dateOfBirthError) onFieldErrorClear('dateOfBirth')
              }}
              error={dateOfBirthError ?? undefined}
            />
            {dateOfBirthError && (
              <p id='date-of-birth-error' className='mt-1 text-sm text-error'>
                {dateOfBirthError}
              </p>
            )}
          </div>
        )}

        {legalEntityType === 'business' && (
          <div>
            <label
              htmlFor='business-registration-number'
              className='mb-1.5 block text-xs font-medium text-text-secondary'
            >
              {m.shop_settings_business_registration_number_label()}
            </label>
            <Input
              id='business-registration-number'
              type='text'
              value={businessRegistrationNumber}
              onChange={(e) => {
                onBusinessRegistrationNumberChange(e.target.value)
                if (businessRegistrationNumberError) onFieldErrorClear('businessRegistrationNumber')
              }}
              placeholder={m.shop_settings_business_registration_number_placeholder()}
              error={businessRegistrationNumberError ?? undefined}
            />
            {businessRegistrationNumberError && (
              <p id='business-registration-number-error' className='mt-1 text-sm text-error'>
                {businessRegistrationNumberError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
