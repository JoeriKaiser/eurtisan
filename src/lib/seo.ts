/**
 * SEO / Meta Tag utility for TanStack Start's head() API.
 *
 * Generates dynamic <title>, <meta>, Open Graph, canonical links,
 * and JSON-LD structured data for public routes.
 */
import { m } from '#/paraglide/messages'

/** Default platform OG image used when no route-specific image is available. */
const DEFAULT_OG_IMAGE_URL = '/logo512.png'

/** Absolute base URL for canonical links and OG URLs (no trailing slash). */
const BASE_URL = typeof process !== 'undefined' ? process.env.PUBLIC_URL || '' : ''

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
 * - Falls back to platform defaults when content is missing
 * - Supports og:price:amount and og:price:currency for product pages
 * - Supports JSON-LD structured data injection
 * - Localization-aware: accepts pre-localized strings from the caller
 */
export function createPageMeta(input: CreatePageMetaInput): PageMetaResult {
  const description = input.description || m.meta_default_description()
  const ogImageUrl = input.ogImageUrl || DEFAULT_OG_IMAGE_URL
  const ogType = input.ogType ?? 'website'
  const fullCanonical = BASE_URL ? `${BASE_URL}${input.canonicalPath}` : input.canonicalPath

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
  ]

  const result: PageMetaResult = { meta, links }

  // JSON-LD structured data
  if (input.jsonLd) {
    result.script = [
      {
        type: 'application/ld+json',
        children: JSON.stringify(input.jsonLd),
      },
    ]
  }

  return result
}
