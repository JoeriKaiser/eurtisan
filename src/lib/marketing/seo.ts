/**
 * SEO / Meta Tag utility for TanStack Start's head() API.
 *
 * Generates dynamic <title>, <meta>, Open Graph, canonical links,
 * and JSON-LD structured data for public routes.
 */
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { getPublicUrl } from '#/lib/public-url'

/** Default platform OG image used when no route-specific image is available. */
const DEFAULT_OG_IMAGE_URL = '/logo512.png'

/** Locale prefixes served by the URL strategy. `en` is the base locale and is unprefixed. */
const LOCALE_PREFIXES = ['/nl'] as const

/**
 * Strips a locale prefix from a canonical path so alternates are built from one
 * locale-free path. Callers normally pass locale-free paths; accepting an
 * already-localized one keeps `/nl` from being duplicated. Leading slashes are
 * collapsed first so a doubled leading slash cannot re-introduce the prefix.
 */
function stripLocalePrefix(path: string): string {
  const normalized = path.replace(/^\/+/, '/')
  for (const prefix of LOCALE_PREFIXES) {
    if (normalized === prefix) return '/'
    if (normalized.startsWith(`${prefix}/`)) return normalized.slice(prefix.length)
    // A root path with a query string, e.g. `/nl?x=1` → `/?x=1`.
    if (normalized.startsWith(`${prefix}?`)) return `/${normalized.slice(prefix.length)}`
  }
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

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
 *   whether the unprefixed English or the `/nl`-prefixed Dutch URL is canonical
 * - hreflang alternates for `en`, `nl`, and `x-default` so search engines pair
 *   both locale variants of the same locale-free path
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
  const currentLocale = getLocale()
  const basePath = stripLocalePrefix(input.canonicalPath)
  const englishHref = toAbsoluteUrl(baseUrl, basePath)
  const dutchHref = toAbsoluteUrl(baseUrl, `/nl${basePath}`)
  const fullCanonical = currentLocale === 'nl' ? dutchHref : englishHref

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
    { property: 'og:locale', content: currentLocale === 'nl' ? 'nl_NL' : 'en_US' },
    { property: 'og:locale:alternate', content: currentLocale === 'nl' ? 'en_US' : 'nl_NL' },
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
    { rel: 'alternate', hreflang: 'en', href: englishHref },
    { rel: 'alternate', hreflang: 'nl', href: dutchHref },
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
