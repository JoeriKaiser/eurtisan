/**
 * Client-safe image URL builder.
 *
 * Constructs imgproxy URLs from S3 object keys for on-the-fly resizing.
 * In development, returns unsigned imgproxy URLs.
 * In production, imgproxy URLs should be pre-generated server-side and
 * passed to components directly.
 */

export function getImageUrl(key: string, options?: { width?: number }): string {
  if (!key) return ''

  // If already a full URL (legacy or pre-generated), return as-is
  if (key.startsWith('http')) {
    return key
  }

  const baseUrl = import.meta.env.VITE_IMGPROXY_BASE_URL || 'http://localhost:8080'

  const widthOpt = options?.width ? `w:${options.width}/` : ''

  // Encode the key for URL safety
  const encodedKey = encodeURIComponent(key)

  return `${baseUrl}/insecure/${widthOpt}plain/s3://eurtisan-uploads/${encodedKey}`
}
