/**
 * Schema.org JSON-LD structured data generators.
 *
 * Produces typed JSON-LD objects for Product, Store, and WebSite
 * schemas that can be passed to `createPageMeta()` for injection
 * into page <head> as `<script type="application/ld+json">`.
 */
import { m } from '#/paraglide/messages'

/** Absolute base URL for schema @id and url fields. */
function getPublicUrl(): string {
  return typeof process !== 'undefined' ? process.env.PUBLIC_URL || '' : ''
}

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
}

/**
 * Generates a Schema.org Store JSON-LD object.
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
