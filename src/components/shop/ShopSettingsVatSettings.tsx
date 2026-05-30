import { Input } from '#/components/ui/input'
import { Switch } from '#/components/ui/switch'

interface ShopSettingsVatSettingsProps {
  isVatRegistered: boolean
  vatId: string
  vatIdError: string | null
  onVatRegisteredChange: (value: boolean) => void
  onVatIdChange: (value: string) => void
  onVatIdErrorClear: () => void
}

export function ShopSettingsVatSettings({
  isVatRegistered,
  vatId,
  vatIdError,
  onVatRegisteredChange,
  onVatIdChange,
  onVatIdErrorClear,
}: ShopSettingsVatSettingsProps) {
  return (
    <div className='rounded-xl border border-border-subtle p-4'>
      <h3 className='mb-3 text-sm font-semibold text-text-primary'>Tax Settings</h3>
      <p className='mb-3 text-xs text-text-muted'>
        If you are registered for VAT in the European Union, enable this and enter your VAT
        Identification Number.
      </p>
      <div className='space-y-4'>
        <div className='flex items-center justify-between rounded-lg border border-border-default p-3'>
          <div>
            <label htmlFor='is-vat-registered' className='text-sm font-medium text-text-primary'>
              Registered for VAT
            </label>
            <p className='text-xs text-text-secondary'>
              I have a registered VAT number for my business.
            </p>
          </div>
          <Switch
            id='is-vat-registered'
            checked={isVatRegistered}
            onCheckedChange={onVatRegisteredChange}
          />
        </div>
        {isVatRegistered && (
          <div>
            <label
              htmlFor='vat-id'
              className='mb-1.5 block text-xs font-medium text-text-secondary'
            >
              VAT ID / Identification Number
            </label>
            <Input
              id='vat-id'
              type='text'
              value={vatId}
              onChange={(e) => {
                onVatIdChange(e.target.value)
                if (vatIdError) onVatIdErrorClear()
              }}
              placeholder='e.g. FR12345678901'
              error={vatIdError ?? undefined}
            />
            {vatIdError && (
              <p id='vat-id-error' className='mt-1 text-sm text-error'>
                {vatIdError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
