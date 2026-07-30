import { Store } from 'lucide-react'
import { useState } from 'react'
import { getImageUrl } from '#/lib/image-url'
import { getShopImageTransitionName } from '#/lib/view-transitions'

export interface ShopBannerProps {
  shopId: string
  bannerImage: string | null
  avatarImage: string | null
}

/**
 * Shop banner with the avatar overlapping its lower edge.
 *
 * Both images are decorative: the shop name is rendered as text immediately
 * below, so announcing them again would be noise.
 *
 * A shop with no banner — or one whose banner fails to load — collapses to the
 * avatar alone. Without the load-failure branch a broken image leaves roughly
 * 340px of empty page above the shop name, which is how the storefront would
 * greet a buyer during any image-delivery outage. The same applies to the
 * avatar, which falls back to the store glyph.
 */
/**
 * Ref callback that catches an image which already failed before hydration.
 *
 * These images are server-rendered, so a failed request fires its `error`
 * event while the HTML is being parsed — before React attaches `onError`, and
 * React does not replay it. A mounted-but-broken image reports `complete` with
 * a `naturalWidth` of zero, which is the only reliable way to detect it after
 * the fact. `onError` still covers failures that happen later.
 */
function detectAlreadyFailed(onFailed: () => void) {
  return (node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth === 0) onFailed()
  }
}

export function ShopBanner({ shopId, bannerImage, avatarImage }: ShopBannerProps) {
  const [bannerFailed, setBannerFailed] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)

  const showBanner = Boolean(bannerImage) && !bannerFailed
  const showAvatar = Boolean(avatarImage) && !avatarFailed

  const avatar = (
    <div
      className='flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-surface-default bg-accent-primary-subtle text-accent-primary shadow-sm sm:size-24'
      style={{ viewTransitionName: getShopImageTransitionName(shopId) }}
    >
      {showAvatar && avatarImage ? (
        <img
          src={getImageUrl(avatarImage, { width: 192, format: 'webp' })}
          alt=''
          className='h-full w-full object-cover'
          ref={detectAlreadyFailed(() => setAvatarFailed(true))}
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        <Store size={32} strokeWidth={1.5} aria-hidden='true' />
      )}
    </div>
  )

  if (!showBanner || !bannerImage) {
    return <div className='mb-6'>{avatar}</div>
  }

  return (
    <div className='mb-6'>
      <div className='relative overflow-hidden rounded-2xl'>
        <img
          src={getImageUrl(bannerImage, { width: 1600, format: 'webp' })}
          srcSet={[640, 960, 1280, 1600]
            .map((w) => `${getImageUrl(bannerImage, { width: w, format: 'webp' })} ${w}w`)
            .join(', ')}
          sizes='(min-width: 1024px) 1024px, 100vw'
          alt=''
          className='aspect-[3/1] w-full object-cover'
          ref={detectAlreadyFailed(() => setBannerFailed(true))}
          onError={() => setBannerFailed(true)}
        />
        {/* Warm scrim so the avatar edge stays legible over any uploaded image.
            Uses the design system's image-scrim token, which inverts with the
            theme, rather than a hardcoded palette value. No text is placed on
            the photograph itself — contrast over an uncontrolled image cannot
            be proven, so type stays on solid surfaces below. */}
        <div
          className='absolute inset-0 bg-gradient-to-t from-scrim-image-subtle to-transparent'
          aria-hidden='true'
        />
      </div>
      <div className='-mt-12 pl-6 sm:-mt-14 sm:pl-10'>{avatar}</div>
    </div>
  )
}
