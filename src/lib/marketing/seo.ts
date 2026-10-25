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

/** Returns the active base origin: configured PUBLIC_URL or window.location.origin in browser. */
function getBaseOrigin(): string {
  const publicUrl = getPublicUrl()
  if (publicUrl) return publicUrl
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

/** Joins the configured public origin with a path without doubling the slash. */
export function toAbsoluteUrl(baseUrl: string, path: string): string {
  if (!baseUrl) return path
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

/**
 * Resolves an image URL to an absolute URL if baseUrl or window.location is available,
 * preserving relative paths in environments where neither exists.
 */
export function resolveImageUrl(imagePath?: string): string {
  const path = imagePath || DEFAULT_OG_IMAGE_URL
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  const base = getBaseOrigin()
  return toAbsoluteUrl(base, path)
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

export interface CreateUtilityMetaInput {
  /** Page title (localized). Appears as <title> and og:title. */
  title: string
  /** Page description (localized). Appears as <meta name="description"> and og:description. Falls back to platform default when empty. */
  description?: string
  /** Absolute or root-relative URL for the OG image. Falls back to platform logo. */
  ogImageUrl?: string
}

export interface PageMetaResult {
  meta: Array<Record<string, string>>
  links?: Array<Record<string, string>>
  script?: Array<Record<string, unknown>>
}

export interface PageMetaWithLinksResult extends PageMetaResult {
  links: Array<Record<string, string>>
}

/**
 * Creates the meta and links arrays expected by TanStack Start's `head()` API.
 *
 * Features:
 * - Dynamic <title>, description, canonical URL, and Open Graph tags
 * - Twitter card tags (twitter:card, twitter:title, twitter:description, twitter:image, twitter:url)
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
export function createPageMeta(input: CreatePageMetaInput): PageMetaWithLinksResult {
  const description = input.description || m.meta_default_description()
  const absoluteOgImageUrl = resolveImageUrl(input.ogImageUrl)
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
    { property: 'og:image', content: absoluteOgImageUrl },
    { property: 'og:site_name', content: 'Eurtisan' },
    { property: 'og:locale', content: EU_OG_LOCALES[currentLocale] },
    { property: 'og:locale:alternate', content: currentLocale === 'en' ? 'nl_NL' : 'en_US' },
    // Twitter
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: input.title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: absoluteOgImageUrl },
    { name: 'twitter:url', content: fullCanonical },
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

  const result: PageMetaWithLinksResult = { meta, links }

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

/**
 * Creates meta tags for utility and error pages (e.g., 404 Not Found).
 *
 * Features:
 * - <title>, <meta name="description">
 * - <meta name="robots" content="noindex, nofollow">
 * - Open Graph baseline tags (og:title, og:description, og:type="website", og:image, og:site_name="Eurtisan")
 * - Twitter card tags (twitter:card, twitter:title, twitter:description, twitter:image)
 * - Empty links array (no canonical or hreflang links)
 */
export function createUtilityMeta(input: CreateUtilityMetaInput): PageMetaResult {
  const description = input.description || m.meta_default_description()
  const absoluteOgImageUrl = resolveImageUrl(input.ogImageUrl)

  return {
    meta: [
      { title: input.title },
      { name: 'description', content: description },
      { name: 'robots', content: 'noindex, nofollow' },
      // Open Graph
      { property: 'og:title', content: input.title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: absoluteOgImageUrl },
      { property: 'og:site_name', content: 'Eurtisan' },
      // Twitter
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: input.title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: absoluteOgImageUrl },
    ],
    links: [],
  }
}

/**
 * Creates meta tags for private/authenticated layouts (e.g., seller dashboard, account settings).
 *
 * Instructs search engines not to index or follow links in private areas.
 */
export function createPrivateLayoutMeta(): PageMetaResult {
  return {
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  }
}

/**
 * Creates baseline platform meta tags for the root document.
 *
 * Sets charset, viewport, default title and description, and fallback Open Graph
 * and Twitter card metadata. Contains no canonical or hreflang links.
 */
export function createRootMeta(): PageMetaResult {
  const defaultTitle = m.meta_title_default()
  const defaultDescription = m.meta_default_description()
  const absoluteDefaultImage = resolveImageUrl(DEFAULT_OG_IMAGE_URL)

  return {
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: defaultTitle },
      { name: 'description', content: defaultDescription },
      // Open Graph
      { property: 'og:site_name', content: 'Eurtisan' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: defaultTitle },
      { property: 'og:description', content: defaultDescription },
      { property: 'og:image', content: absoluteDefaultImage },
      // Twitter
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: defaultTitle },
      { name: 'twitter:description', content: defaultDescription },
      { name: 'twitter:image', content: absoluteDefaultImage },
    ],
  }
}
