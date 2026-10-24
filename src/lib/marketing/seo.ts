/**
 * SEO / Meta Tag utility for TanStack Start's head() API.
 *
 * Generates dynamic <title>, <meta>, Open Graph, canonical links,
 * and JSON-LD structured data for public routes.
 */
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { getPublicUrl } from '#/lib/public-url'
import {
  EU_LOCALES,
  EU_OG_LOCALES,
  resolveEuLocale,
  stripEuLocalePrefix,
} from '#/lib/i18n/eu-locales'

/** Default platform OG image used when no route-specific image is available. */
const DEFAULT_OG_IMAGE_URL = '/logo512.png'

/** Joins the configured public origin with a path without doubling the slash. */
function toAbsoluteUrl(baseUrl: string, path: string): string {
  if (!baseUrl) return path
  return `${baseUrl.replace(/\/+$/, '')}${path}`
}

export interface CreatePageMetaInput {
  /** Page title (localized). Appears as <title> and og:title. */
  title: string
  /** Page description (localized). Appears as <meta name="description"> and og:description. Falls back to platform default when empty. */
  description: string
  /** Canonical path, e.g. "/products/handmade-vase". Must start with "/". */
  canonicalPath: string
  /** Absolute or root-relative URL for the OG image. Falls back to platform logo. */
  ogImageUrl?: string
  /** Open Graph type. Defaults to "website". Use "product" for product pages. */
  ogType?: string
  /** Optional JSON-LD structured data object. */
  jsonLd?: Record<string, unknown>
  /** Product price data for og:price:amount and og:price:currency meta tags. */
  productPrice?: { amount: string; currency: string }
}

export interface PageMetaResult {
  meta: Array<Record<string, string>>
  links: Array<Record<string, string>>
  script?: Array<Record<string, unknown>>
}

/**
 * Creates the meta and links arrays expected by TanStack Start's `head()` API.
 *
 * Features:
 * - Dynamic <title>, description, canonical URL, and Open Graph tags
 * - Locale-aware canonical URL: the active locale from `getLocale()` decides
 *   whether the unprefixed English or the `/${locale}`-prefixed EU locale URL is canonical
 * - hreflang alternates for all 24 EU locales and `x-default` so search engines pair
 *   all locale variants of the same locale-free path
 * - og:locale and og:locale:alternate reflecting the active locale
 * - Falls back to platform defaults when content is missing
 * - Supports og:price:amount and og:price:currency for product pages
 * - Supports JSON-LD structured data injection
 * - Localization-aware: accepts pre-localized strings from the caller
 */
export function createPageMeta(input: CreatePageMetaInput): PageMetaResult {
  const description = input.description || m.meta_default_description()
  const ogImageUrl = input.ogImageUrl || DEFAULT_OG_IMAGE_URL
  const ogType = input.ogType ?? 'website'
  const baseUrl = getPublicUrl()
  const currentLocale = resolveEuLocale(getLocale(), 'en')
  const basePath = stripEuLocalePrefix(input.canonicalPath)
  const englishHref = toAbsoluteUrl(baseUrl, basePath)
  const alternateLinks: Array<Record<string, string>> = []
  let fullCanonical = englishHref

  for (const locale of EU_LOCALES) {
    const href = locale === 'en' ? englishHref : toAbsoluteUrl(baseUrl, `/${locale}${basePath}`)
    if (locale === currentLocale) {
      fullCanonical = href
    }
    alternateLinks.push({ rel: 'alternate', hreflang: locale, href })
  }

  const meta: Array<Record<string, string>> = [
    { title: input.title },
    { name: 'description', content: description },
    // Open Graph
    { property: 'og:title', content: input.title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: ogType },
    { property: 'og:url', content: fullCanonical },
    { property: 'og:image', content: ogImageUrl },
    { property: 'og:site_name', content: 'Eurtisan' },
    { property: 'og:locale', content: EU_OG_LOCALES[currentLocale] },
    { property: 'og:locale:alternate', content: currentLocale === 'en' ? 'nl_NL' : 'en_US' },
  ]

  // Product price OG tags
  if (input.productPrice) {
    meta.push(
      { property: 'og:price:amount', content: input.productPrice.amount },
      { property: 'og:price:currency', content: input.productPrice.currency },
    )
  }

  const links: Array<Record<string, string>> = [
    { rel: 'canonical', href: fullCanonical },
    ...alternateLinks,
    { rel: 'alternate', hreflang: 'x-default', href: englishHref },
  ]

  const result: PageMetaResult = { meta, links }

  // JSON-LD structured data
  if (input.jsonLd) {
    // Escape `<` as `\u003c` to prevent `</script>` injection inside the
    // JSON-LD block. TanStack Router renders script children via
    // dangerouslySetInnerHTML, so HTML-sensitive characters in the JSON
    // string must be neutralised while remaining valid JSON.
    const safeJson = JSON.stringify(input.jsonLd).replace(/</g, '\\u003c')
    result.script = [
      {
        type: 'application/ld+json',
        children: safeJson,
      },
    ]
  }

  return result
}
