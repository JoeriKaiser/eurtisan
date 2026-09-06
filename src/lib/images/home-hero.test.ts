import { describe, expect, it } from 'vitest'
import {
  getHomeHeroLcpPreload,
  getHomeHeroLcpSrcSet,
  getHomeHeroLcpUrl,
  HOME_HERO_FALLBACK_IMAGE,
  HOME_HERO_LCP_SIZES,
} from './home-hero'

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

describe('getHomeHeroLcpSrcSet', () => {
  it('is omitted for the static fallback', () => {
    expect(getHomeHeroLcpSrcSet(undefined)).toBeUndefined()
    expect(getHomeHeroLcpSrcSet(null)).toBeUndefined()
  })

  it('lists 480, 720, and 960 WebP variants for an uploaded shop image', () => {
    expect(getHomeHeroLcpSrcSet('shops/hero-shop.webp')).toBe(
      '/api/image?key=shops%2Fhero-shop.webp&width=480&format=webp 480w, /api/image?key=shops%2Fhero-shop.webp&width=720&format=webp 720w, /api/image?key=shops%2Fhero-shop.webp&width=960&format=webp 960w',
    )
  })
})

describe('getHomeHeroLcpPreload', () => {
  it('preloads the fallback image at high priority', () => {
    expect(getHomeHeroLcpPreload(null)).toEqual({
      rel: 'preload',
      as: 'image',
      href: HOME_HERO_FALLBACK_IMAGE,
      fetchPriority: 'high',
    })
  })

  it('includes matching srcset and sizes for an uploaded shop image', () => {
    const preload = getHomeHeroLcpPreload('shops/hero-shop.webp')
    expect(preload.href).toBe('/api/image?key=shops%2Fhero-shop.webp&width=960&format=webp')
    expect(preload.imageSrcSet).toContain('width=480')
    expect(preload.imageSrcSet).toContain('width=960')
    expect(preload.imageSizes).toBe(HOME_HERO_LCP_SIZES)
    expect(preload.fetchPriority).toBe('high')
  })
})
