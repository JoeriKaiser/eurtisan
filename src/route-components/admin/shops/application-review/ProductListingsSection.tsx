import { SUPPORTED_CURRENCY } from '#/lib/currency'
import { getImageUrl } from '#/lib/image-url'
import { m } from '#/paraglide/messages'

interface AppListing {
  id: string
  name: string
  description: string | null
  priceCents: number
  stockCount: number
  imageCount: number
  thumbnailUrl: string | null
}

const PRICE_FORMATTER = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: SUPPORTED_CURRENCY,
})

function formatPrice(cents: number): string {
  return PRICE_FORMATTER.format(cents / 100)
}

interface ProductListingsSectionProps {
  listings: AppListing[]
}

export function ProductListingsSection({ listings }: ProductListingsSectionProps) {
  return (
    <div className='space-y-2'>
      <h3 className='text-xs font-semibold uppercase tracking-wider text-text-muted'>
        {m.admin_shops_application_section_product()}
      </h3>
      <div className='bg-surface-inset rounded-xl p-4 border border-border-subtle'>
        {listings && listings.length > 0 ? (
          listings.map((listing) => (
            <div key={listing.id} className='space-y-3'>
              <div className='flex gap-4 items-start'>
                {listing.imageCount > 0 && listing.thumbnailUrl ? (
                  <div className='size-20 rounded-lg overflow-hidden border border-border-default bg-surface-default flex-shrink-0 shadow-sm'>
                    <img
                      src={getImageUrl(listing.thumbnailUrl)}
                      alt={listing.name}
                      className='w-full h-full object-cover'
                    />
                  </div>
                ) : (
                  <div className='size-20 rounded-lg bg-surface-default border border-border-subtle flex items-center justify-center text-text-muted text-xs flex-shrink-0'>
                    No Image
                  </div>
                )}
                <div className='flex-1 min-w-0'>
                  <p className='font-semibold text-text-primary'>{listing.name}</p>
                  <p className='text-xs text-text-secondary mt-1 line-clamp-2'>
                    {listing.description || 'No description'}
                  </p>
                  <div className='flex gap-4 mt-2 text-xs'>
                    <span className='text-text-muted'>
                      {m.admin_shops_application_field_price()}:{' '}
                      <span className='font-mono font-semibold text-text-primary'>
                        {formatPrice(listing.priceCents)}
                      </span>
                    </span>
                    <span className='text-text-muted'>
                      {m.admin_shops_application_field_stock()}:{' '}
                      <span className='font-mono font-semibold text-text-primary'>
                        {listing.stockCount}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className='text-sm text-text-muted'>{m.admin_shops_application_no_listings()}</p>
        )}
      </div>
    </div>
  )
}
