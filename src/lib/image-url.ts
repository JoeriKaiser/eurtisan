/**
 * Client-safe image URL builder.
 *
 * Constructs imgproxy URLs from S3 object keys for on-the-fly resizing
 * and WebP conversion.
 * In development, returns unsigned imgproxy URLs.
 * In production, imgproxy URLs should be pre-generated server-side and
 * passed to components directly.
 */

export interface ImageUrlOptions {
  width?: number
  format?: 'webp' | 'avif' | 'jpeg' | 'png'
}

export function getImageUrl(key: string, options?: ImageUrlOptions): string {
  if (!key) return ''

  // If already a full URL or legacy local path (legacy or pre-generated), return as-is
  if (key.startsWith('http') || key.startsWith('/uploads/')) {
    return key
  }

  const baseUrl = import.meta.env.VITE_IMGPROXY_BASE_URL || 'http://localhost:8080'
  const bucket = import.meta.env.VITE_S3_BUCKET || 'eurtisan-uploads'

  const opts: string[] = []
  if (options?.width) {
    opts.push(`w:${options.width}`)
  }
  if (options?.format) {
    opts.push(`f:${options.format}`)
  }

  const optsPath = opts.length > 0 ? `${opts.join('/')}/` : ''

  return `${baseUrl}/insecure/${optsPath}plain/s3://${bucket}/${key}`
}
