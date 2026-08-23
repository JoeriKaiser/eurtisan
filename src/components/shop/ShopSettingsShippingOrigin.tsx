import { m } from '#/paraglide/messages'
import { Input } from '#/components/ui/input'

interface ShopSettingsShippingOriginProps {
  originStreet: string
  originCity: string
  originPostal: string
  originCountry: string
  onStreetChange: (value: string) => void
  onCityChange: (value: string) => void
  onPostalChange: (value: string) => void
  onCountryChange: (value: string) => void
}

export function ShopSettingsShippingOrigin({
  originStreet,
  originCity,
  originPostal,
  originCountry,
  onStreetChange,
  onCityChange,
  onPostalChange,
  onCountryChange,
}: ShopSettingsShippingOriginProps) {
  return (
    <div className='rounded-xl border border-border-subtle p-4'>
      <h3 className='mb-3 text-sm font-semibold text-text-primary'>{m.shipping_origin_title()}</h3>
      <p className='mb-3 text-xs text-text-muted'>{m.shipping_origin_description()}</p>
      <div className='space-y-3'>
        <div>
          <label
            htmlFor='origin-street'
            className='mb-1.5 block text-xs font-medium text-text-secondary'
          >
            {m.creator_shop_address_street_label()}
          </label>
          <Input
            id='origin-street'
            type='text'
            value={originStreet}
            onChange={(e) => onStreetChange(e.target.value)}
            placeholder={m.creator_shop_address_street_placeholder()}
          />
        </div>
        <div className='grid grid-cols-2 gap-3'>
          <div>
            <label
              htmlFor='origin-city'
              className='mb-1.5 block text-xs font-medium text-text-secondary'
            >
              {m.creator_shop_address_city_label()}
            </label>
            <Input
              id='origin-city'
              type='text'
              value={originCity}
              onChange={(e) => onCityChange(e.target.value)}
              placeholder={m.shipping_origin_city_placeholder()}
            />
          </div>
          <div>
            <label
              htmlFor='origin-postal'
              className='mb-1.5 block text-xs font-medium text-text-secondary'
            >
              {m.creator_shop_address_postal_label()}
            </label>
            <Input
              id='origin-postal'
              type='text'
              value={originPostal}
              onChange={(e) => onPostalChange(e.target.value)}
              placeholder='10115'
            />
          </div>
        </div>
        <div>
          <label
            htmlFor='origin-country'
            className='mb-1.5 block text-xs font-medium text-text-secondary'
          >
            {m.creator_shop_address_country_label()}
          </label>
          <Input
            id='origin-country'
            type='text'
            value={originCountry}
            onChange={(e) => onCountryChange(e.target.value.toUpperCase().slice(0, 2))}
            placeholder='DE'
            maxLength={2}
          />
        </div>
      </div>
    </div>
  )
}
