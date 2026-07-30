/**
 * Schema.org JSON-LD structured data generators.
 *
 * Produces typed JSON-LD objects for Product, Store, and WebSite
 * schemas that can be passed to `createPageMeta()` for injection
 * into page <head> as `<script type="application/ld+json">`.
 */
import { m } from '#/paraglide/messages'
import { getPublicUrl } from '#/lib/public-url'

/**
 * Product structured data input.
 *
 * Accepts only the fields needed to produce a valid Schema.org Product.
 */
export interface ProductJsonLdInput {
  productId: string
  name: string
  description: string | null
  /** Product page path, e.g. "/products/handmade-vase". */
  canonicalPath: string
  /** Product images (sorted), at least the `url` is required per image. */
  images: { url: string }[]
  /** Decimal price string, e.g. "29.99". */
  price: string
  /** ISO 4217 currency code, default: "EUR". */
  currency?: string
  /** Stock count — > 0 means InStock, otherwise OutOfStock. */
  stockCount: number
  /** The shop / brand name that sells this product. */
  brandName?: string
  /** Optional category name matching Schema.org category. */
  categoryName?: string | null
}

/**
 * Generates a Schema.org Product JSON-LD object.
 *
 * @see https://schema.org/Product
 */
export function generateProductJsonLd(input: ProductJsonLdInput): Record<string, unknown> {
  const baseUrl = getPublicUrl()
  const fullUrl = baseUrl ? `${baseUrl}${input.canonicalPath}` : input.canonicalPath
  const currency = input.currency ?? 'EUR'

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': fullUrl,
    name: input.name,
    url: fullUrl,
    sku: input.productId,
    offers: {
      '@type': 'Offer',
      price: input.price,
      priceCurrency: currency,
      availability:
        input.stockCount > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: fullUrl,
    },
  }

  // Description — omit if missing rather than setting to null
  if (input.description) {
    jsonLd.description = input.description
  }

  // Image array — omit if empty
  if (input.images.length > 0) {
    jsonLd.image = input.images.map((img) => img.url)
  }

  // Brand
  if (input.brandName) {
    jsonLd.brand = {
      '@type': 'Brand',
      name: input.brandName,
    }
  }

  // Category (optional)
  if (input.categoryName) {
    jsonLd.category = input.categoryName
  }

  return jsonLd
}

/**
 * Store structured data input.
 */
export interface StoreJsonLdInput {
  shopName: string
  description: string | null
  /** Shop page path, e.g. "/shops/my-shop". */
  canonicalPath: string
  /** Banner / logo image URL. */
  image?: string | null
  /** Avatar, published as `logo` when present. */
  logo?: string | null
  /**
   * Validated profile URLs for this shop. Already scheme-checked by
   * `publicSocialSchema`; anything not `http(s)` is dropped again here.
   */
  sameAs?: string[]
  /**
   * ISO-3166-1 alpha-2 country. Country only, never the street-level fields —
   * see the storefront plan §4.3: the rest of that column is seller PII.
   */
  addressCountry?: string | null
  /**
   * Shop-level rating. Pass it **only** above the display threshold
   * (`SHOP_RATING_MIN_REVIEWS`); `ShopProfile.rating` is already null below it.
   * An `aggregateRating` built from one review is a structured-data violation
   * and risks a manual action.
   */
  aggregateRating?: { ratingValue: number; reviewCount: number } | null
}

/**
 * Generates a Schema.org Store JSON-LD object.
 *
 * Every optional property is omitted rather than emitted empty: a `sameAs: []`
 * or a zero-review `aggregateRating` is worse than silence, because it asserts
 * something false about the shop.
 *
 * @see https://schema.org/Store
 */
export function generateStoreJsonLd(input: StoreJsonLdInput): Record<string, unknown> {
  const baseUrl = getPublicUrl()
  const fullUrl = baseUrl ? `${baseUrl}${input.canonicalPath}` : input.canonicalPath

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    '@id': fullUrl,
    name: input.shopName,
    url: fullUrl,
  }

  if (input.description) {
    jsonLd.description = input.description
  }

  if (input.image) {
    jsonLd.image = input.image
  }

  if (input.logo) {
    jsonLd.logo = input.logo
  }

  // Second scheme check. `publicSocialSchema` already filtered at read, but a
  // stored `javascript:` URL is an XSS vector and this value is serialised into
  // a <script> tag, so it is validated at both ends.
  const profiles = (input.sameAs ?? []).filter((url) => /^https?:\/\//i.test(url))
  if (profiles.length > 0) {
    jsonLd.sameAs = profiles
  }

  if (input.addressCountry) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      addressCountry: input.addressCountry,
    }
  }

  if (input.aggregateRating && input.aggregateRating.reviewCount > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: input.aggregateRating.ratingValue,
      reviewCount: input.aggregateRating.reviewCount,
    }
  }

  return jsonLd
}

/**
 * WebSite structured data input.
 */
export interface WebSiteJsonLdInput {
  /** Site name, default: "Eurtisan". */
  name?: string
  /** Homepage URL, default: BASE_URL or "/". */
  url?: string
  /** Search URL template, e.g. "https://eurtisan.eu/search?q={search_term_string}". */
  searchUrlTemplate?: string
}

/**
 * Generates a Schema.org WebSite JSON-LD object with SearchAction.
 *
 * @see https://schema.org/WebSite
 */
export function generateWebSiteJsonLd(input: WebSiteJsonLdInput = {}): Record<string, unknown> {
  const baseUrl = getPublicUrl()
  const siteUrl = input.url ?? (baseUrl || '/')
  const siteName = input.name ?? m.meta_title_default()
  const searchTemplate = input.searchUrlTemplate ?? `${baseUrl || ''}/search?q={search_term_string}`

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': siteUrl,
    name: siteName,
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: searchTemplate,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return jsonLd
}
