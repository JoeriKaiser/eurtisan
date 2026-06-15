import { Input } from '#/components/ui/input'
import { m } from '#/paraglide/messages'

interface ShopSettingsBusinessAddressProps {
  street: string
  city: string
  postal: string
  country: string
  onStreetChange: (value: string) => void
  onCityChange: (value: string) => void
  onPostalChange: (value: string) => void
  onCountryChange: (value: string) => void
}

export function ShopSettingsBusinessAddress({
  street,
  city,
  postal,
  country,
  onStreetChange,
  onCityChange,
  onPostalChange,
  onCountryChange,
}: ShopSettingsBusinessAddressProps) {
  return (
    <div className='rounded-xl border border-border-subtle p-4'>
      <h3 className='mb-1 text-sm font-semibold text-text-primary'>
        {m.creator_shop_business_address_title()}
      </h3>
      <p className='mb-3 text-xs text-text-muted'>
        {m.creator_shop_business_address_description()}
      </p>
      <div className='space-y-3'>
        <div>
          <label
            htmlFor='business-street'
            className='mb-1.5 block text-xs font-medium text-text-secondary'
          >
            {m.creator_shop_address_street_label()}
          </label>
          <Input
            id='business-street'
            type='text'
            value={street}
            onChange={(e) => onStreetChange(e.target.value)}
            placeholder={m.creator_shop_address_street_placeholder()}
          />
        </div>
        <div className='grid grid-cols-2 gap-3'>
          <div>
            <label
              htmlFor='business-city'
              className='mb-1.5 block text-xs font-medium text-text-secondary'
            >
              {m.creator_shop_address_city_label()}
            </label>
            <Input
              id='business-city'
              type='text'
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
              placeholder={m.creator_shop_address_city_placeholder()}
            />
          </div>
          <div>
            <label
              htmlFor='business-postal'
              className='mb-1.5 block text-xs font-medium text-text-secondary'
            >
              {m.creator_shop_address_postal_label()}
            </label>
            <Input
              id='business-postal'
              type='text'
              value={postal}
              onChange={(e) => onPostalChange(e.target.value)}
              placeholder={m.creator_shop_address_postal_placeholder()}
            />
          </div>
        </div>
        <div>
          <label
            htmlFor='business-country'
            className='mb-1.5 block text-xs font-medium text-text-secondary'
          >
            {m.creator_shop_address_country_label()}
          </label>
          <Input
            id='business-country'
            type='text'
            value={country}
            onChange={(e) => onCountryChange(e.target.value.toUpperCase().slice(0, 2))}
            placeholder={m.creator_shop_address_country_placeholder()}
            maxLength={2}
          />
        </div>
      </div>
    </div>
  )
}
