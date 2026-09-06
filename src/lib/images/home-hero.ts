import { getImageUrl } from './url'

export const HOME_HERO_FALLBACK_IMAGE = '/images/hero_artisan_goods.webp'
export const HOME_HERO_LCP_WIDTH = 960
export const HOME_HERO_LCP_WIDTHS = [480, 720, 960] as const
export const HOME_HERO_LCP_SIZES = '(max-width: 1023px) 100vw, 42vw'

export function getHomeHeroLcpUrl(shopImage: string | null | undefined): string {
  if (!shopImage) {
    return HOME_HERO_FALLBACK_IMAGE
  }

  return getImageUrl(shopImage, { width: HOME_HERO_LCP_WIDTH, format: 'webp' })
}

export function getHomeHeroLcpSrcSet(shopImage: string | null | undefined): string | undefined {
  if (!shopImage) {
    return undefined
  }

  return HOME_HERO_LCP_WIDTHS.map(
    (width) => `${getImageUrl(shopImage, { width, format: 'webp' })} ${width}w`,
  ).join(', ')
}

export function getHomeHeroLcpPreload(
  shopImage: string | null | undefined,
): Record<string, string> {
  const preload: Record<string, string> = {
    rel: 'preload',
    as: 'image',
    href: getHomeHeroLcpUrl(shopImage),
    fetchPriority: 'high',
  }
  const srcSet = getHomeHeroLcpSrcSet(shopImage)
  if (srcSet) {
    preload.imageSrcSet = srcSet
    preload.imageSizes = HOME_HERO_LCP_SIZES
  }
  return preload
}
