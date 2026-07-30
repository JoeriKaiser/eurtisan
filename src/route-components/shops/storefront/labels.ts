import type { ShopProductionType, ShopSocialPlatform } from '#/lib/shop-profile'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'

/**
 * Message lookups are written as switches rather than as a record keyed by the
 * union, because each paraglide message is its own function and a record would
 * call all of them on every render.
 */
export function productionTypeLabel(type: ShopProductionType): string {
  switch (type) {
    case 'handmade':
      return m.shop_production_handmade()
    case 'vintage':
      return m.shop_production_vintage()
    case 'supplies':
      return m.shop_production_supplies()
    case 'mixed':
      return m.shop_production_mixed()
  }
}

export function socialPlatformLabel(platform: ShopSocialPlatform): string {
  switch (platform) {
    case 'website':
      return m.shop_social_website()
    case 'instagram':
      return m.shop_social_instagram()
    case 'facebook':
      return m.shop_social_facebook()
    case 'twitter':
      return m.shop_social_twitter()
    case 'tiktok':
      return m.shop_social_tiktok()
    case 'pinterest':
      return m.shop_social_pinterest()
    case 'youtube':
      return m.shop_social_youtube()
  }
}

/** Localized country name, falling back to the raw code. */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames([getLocale()], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

/** Localized language names for the shop's declared languages. */
export function languageNames(codes: readonly string[]): string[] {
  let display: Intl.DisplayNames | null = null
  try {
    display = new Intl.DisplayNames([getLocale()], { type: 'language' })
  } catch {
    display = null
  }
  return codes.map((code) => {
    try {
      return display?.of(code) ?? code
    } catch {
      return code
    }
  })
}

/**
 * Whether a URL is safe to render as a link.
 *
 * The read-time projection already filters these, but a stored `javascript:`
 * URL is an XSS vector and this is the layer closest to the DOM, so it checks
 * again rather than trusting its input.
 */
export function isSafeHttpUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
