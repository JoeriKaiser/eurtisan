import { getImageUrl } from '#/lib/image-url'
import { m } from '#/paraglide/messages'

interface ShopVisualsSectionProps {
  image: string | null
  bannerImage: string | null
}

export function ShopVisualsSection({ image, bannerImage }: ShopVisualsSectionProps) {
  return (
    <div className='space-y-2'>
      <h3 className='text-xs font-semibold uppercase tracking-wider text-text-muted'>
        {m.admin_shops_application_section_visuals()}
      </h3>
      <div className='bg-surface-inset rounded-xl p-4 space-y-4 border border-border-subtle'>
        <div className='flex gap-4 items-center'>
          {image ? (
            <div className='size-16 rounded-full overflow-hidden border border-border-default bg-surface-default flex-shrink-0 shadow-sm'>
              <img
                src={getImageUrl(image, { width: 160, format: 'webp' })}
                alt={m.admin_shops_application_logo_alt()}
                className='h-full w-full object-cover'
              />
            </div>
          ) : (
            <div className='size-16 rounded-full bg-surface-default border border-border-subtle flex items-center justify-center text-text-muted text-xs flex-shrink-0'>
              No Logo
            </div>
          )}
          <div>
            <p className='text-xs text-text-muted'>Shop Logo / Avatar</p>
            <p className='text-xs text-text-secondary'>Displayed on public profiles.</p>
          </div>
        </div>
        <div>
          <p className='text-xs text-text-muted mb-1.5'>Banner Image</p>
          {bannerImage ? (
            <div className='h-32 w-full rounded-lg overflow-hidden border border-border-default bg-surface-default shadow-sm'>
              <img
                src={getImageUrl(bannerImage, { width: 960, format: 'webp' })}
                alt={m.admin_shops_application_banner_alt()}
                className='h-full w-full object-cover'
              />
            </div>
          ) : (
            <div className='h-20 w-full rounded-lg bg-surface-default border border-border-subtle flex items-center justify-center text-text-muted text-sm shadow-inner'>
              No Banner Image
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
