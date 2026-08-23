/**
 * SEO / Meta Tag utility for TanStack Start's head() API.
 *
 * Generates dynamic <title>, <meta>, Open Graph, canonical links,
 * hreflang alternates, and JSON-LD structured data for public routes.
 * Canonical URLs are rewritten through Paraglide so they carry the active
 * locale's URL prefix (mirroring the router's rewrite.output mapping).
 */
import { m } from '#/paraglide/messages'
import { getPublicUrl } from '#/lib/public-url'
import { baseLocale, getLocale, localizeUrl, locales } from '#/paraglide/runtime'

/** Default platform OG image used when no route-specific image is available. */
const DEFAULT_OG_IMAGE_URL = '/logo512.png'

/**
 * Open Graph locale identifiers per Paraglide locale. og:locale requires the
 * underscore-separated format (e.g. en_US), not bare language codes.
 */
const OG_LOCALE: Record<(typeof locales)[number], string> = {
  en: 'en_US',
  nl: 'nl_NL',
}

/**
 * Placeholder origin used to absolutize root-relative canonical paths before
 * Paraglide URL rewriting. Only the localized path is emitted when PUBLIC_URL
 * is not configured, so this origin never reaches rendered metadata.
 */
const LOCALIZE_ORIGIN = 'https://eurtisan.local'

export interface CreatePageMetaInput {
  /** Page title (localized). Appears as <title> and og:title. */
  title: string
  /** Page description (localized). Appears as <meta name="description"> and og:description. Falls back to platform default when empty. */
  description: string
  /** Canonical path, e.g. "/products/handmade-vase". Must start with "/". De-localized: the active locale prefix is applied automatically. */
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
 * Resolves a de-localized canonical path to an href for `locale`, using
 * Paraglide's URL rewriting so the mapping matches the router's
 * `rewrite.output`: non-default locales get their URL prefix (e.g. `/nl/about`),
 * the default locale stays unprefixed.
 */
function localizedHref(canonicalPath: string, locale: (typeof locales)[number]): string {
  const baseUrl = getPublicUrl()
  const url = localizeUrl(new URL(canonicalPath, baseUrl || LOCALIZE_ORIGIN), { locale })
  // Paraglide localizes the root path to `/nl/`; keep `/nl` canonical.
  if (url.pathname.endsWith('/') && url.pathname.length > 1) {
    url.pathname = url.pathname.slice(0, -1)
  }
  return baseUrl ? `${url.origin}${url.pathname}${url.search}` : `${url.pathname}${url.search}`
}

/**
 * hreflang alternates covering every supported locale plus x-default, which
 * points at the default-locale URL of the same path.
 */
function alternateLinks(canonicalPath: string): Array<Record<string, string>> {
  return [
    ...locales.map((locale) => ({
      rel: 'alternate',
      hreflang: locale,
      href: localizedHref(canonicalPath, locale),
    })),
    {
      rel: 'alternate',
      hreflang: 'x-default',
      href: localizedHref(canonicalPath, baseLocale),
    },
  ]
}

/**
 * Creates the meta and links arrays expected by TanStack Start's `head()` API.
 *
 * Features:
 * - Dynamic <title>, description, canonical URL, and Open Graph tags
 * - Falls back to platform defaults when content is missing
 * - Supports og:price:amount and og:price:currency for product pages
 * - Supports JSON-LD structured data injection
 * - Localization-aware: accepts pre-localized strings from the caller
 * - Rewrites canonical URLs through Paraglide and emits hreflang alternates
 * - Emits og:locale and og:locale:alternate for the supported locales
 */

export function createPageMeta(input: CreatePageMetaInput): PageMetaResult {
  const description = input.description || m.meta_default_description()
  const ogImageUrl = input.ogImageUrl || DEFAULT_OG_IMAGE_URL
  const ogType = input.ogType ?? 'website'
  const locale = getLocale()

  const fullCanonical = localizedHref(input.canonicalPath, locale)

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
    { property: 'og:locale', content: OG_LOCALE[locale] },
    ...locales
      .filter((other) => other !== locale)
      .map((other) => ({ property: 'og:locale:alternate', content: OG_LOCALE[other] })),
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
    ...alternateLinks(input.canonicalPath),
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
