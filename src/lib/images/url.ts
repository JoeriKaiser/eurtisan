import { buildImageDeliveryUrl } from './delivery'

/**
 * Client-safe image URL builder.
 *
 * Bare object keys are sent through the same-origin image delivery endpoint.
 * That endpoint validates resize options and signs the imgproxy path server-side,
 * so browser bundles never receive the signing key or generate open-proxy URLs.
 */

export interface ImageUrlOptions {
  width?: number
  format?: 'webp' | 'avif' | 'jpeg' | 'png'
}

const imageKeyRegex = /^(products|shops)\/[^/]+\.(jpg|jpeg|png|webp)$/
const imageUrlRegex = /^(https?:\/\/[^/]+|\/uploads\/).+\.(jpg|jpeg|png|webp)$/i

/**
 * Checks whether a value is an externally-hosted image URL (absolute http(s)
 * or /uploads/ path) rather than an S3 object key.
 */
export function isExternalImageUrl(value: string): boolean {
  return imageUrlRegex.test(value)
}

/**
 * Extracts the object key from supported URL formats.
 * Returns null if the URL does not match a known platform URL format.
 */
export function extractKeyFromUrl(url: string): string | null {
  if (!url) return null

  // Already a bare key (products/... or shops/...)
  if (imageKeyRegex.test(url)) {
    return url
  }

  // Local uploads path: /uploads/products/... or /uploads/shops/...
  const uploadsMatch = url.match(/\/uploads\/(products\/[^/]+\.(jpg|jpeg|png|webp))$/)
  if (uploadsMatch) return uploadsMatch[1]

  const uploadsShopMatch = url.match(/\/uploads\/(shops\/[^/]+\.(jpg|jpeg|png|webp))$/)
  if (uploadsShopMatch) return uploadsShopMatch[1]

  // S3 object URL: http(s)://.../eurtisan-uploads/products/...
  const s3Match = url.match(/\/eurtisan-uploads\/(products\/[^/]+\.(jpg|jpeg|png|webp))$/)
  if (s3Match) return s3Match[1]

  const s3ShopMatch = url.match(/\/eurtisan-uploads\/(shops\/[^/]+\.(jpg|jpeg|png|webp))$/)
  if (s3ShopMatch) return s3ShopMatch[1]

  return null
}

export function getImageUrl(key: string, options?: ImageUrlOptions): string {
  if (!key) return ''

  // If already a full URL or uploads path, return as-is
  if (key.startsWith('http') || key.startsWith('/uploads/')) {
    return key
  }

  return buildImageDeliveryUrl(key, options)
}
