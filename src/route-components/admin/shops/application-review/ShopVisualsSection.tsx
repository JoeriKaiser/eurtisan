interface ShopVisualsSectionProps {
  image: string | null
  bannerImage: string | null
}

function isSafeImageUrl(url: string | null): url is string {
  if (!url) return false
  return url.startsWith('/uploads/') || url.startsWith('http://') || url.startsWith('https://')
}

export function ShopVisualsSection({ image, bannerImage }: ShopVisualsSectionProps) {
  return (
    <div className='space-y-2'>
      <h3 className='text-xs font-semibold uppercase tracking-wider text-text-muted'>
        Shop Visuals
      </h3>
      <div className='bg-surface-inset rounded-xl p-4 space-y-4 border border-border-subtle'>
        <div className='flex gap-4 items-center'>
          {image && isSafeImageUrl(image) ? (
            <div className='size-16 rounded-full overflow-hidden border border-border-default bg-surface-default flex-shrink-0 shadow-sm'>
              <img src={image} alt='Logo' className='w-full h-full object-cover' />
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
          {bannerImage && isSafeImageUrl(bannerImage) ? (
            <div className='h-32 w-full rounded-lg overflow-hidden border border-border-default bg-surface-default shadow-sm'>
              <img src={bannerImage} alt='Banner' className='w-full h-full object-cover' />
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
