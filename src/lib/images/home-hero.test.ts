import { describe, expect, it } from 'vitest'
import { getHomeHeroLcpUrl, HOME_HERO_FALLBACK_IMAGE } from './home-hero'

describe('getHomeHeroLcpUrl', () => {
  it('returns the static fallback when no shop image is present', () => {
    expect(getHomeHeroLcpUrl(undefined)).toBe(HOME_HERO_FALLBACK_IMAGE)
    expect(getHomeHeroLcpUrl(null)).toBe(HOME_HERO_FALLBACK_IMAGE)
    expect(getHomeHeroLcpUrl('')).toBe(HOME_HERO_FALLBACK_IMAGE)
  })

  it('builds a same-origin WebP delivery URL for an uploaded shop image', () => {
    expect(getHomeHeroLcpUrl('shops/hero-shop.webp')).toBe(
      '/api/image?key=shops%2Fhero-shop.webp&width=960&format=webp',
    )
  })
})
