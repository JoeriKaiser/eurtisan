import { getImageUrl } from './url'

export const HOME_HERO_FALLBACK_IMAGE = '/images/hero_artisan_goods.webp'
export const HOME_HERO_LCP_WIDTH = 960

export function getHomeHeroLcpUrl(shopImage: string | null | undefined): string {
  if (!shopImage) {
    return HOME_HERO_FALLBACK_IMAGE
  }

  return getImageUrl(shopImage, { width: HOME_HERO_LCP_WIDTH, format: 'webp' })
}
