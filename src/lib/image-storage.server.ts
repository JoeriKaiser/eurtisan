/**
 * Image storage abstraction over S3-compatible object storage.
 *
 * All image operations go through this module. In development, images are
 * stored in Garage. In staging/production, images are stored in Scaleway
 * Object Storage. The same code runs in every environment — only the
 * S3_ENDPOINT and credentials change.
 *
 * Upload flow (presigned URLs):
 * 1. Authenticated client requests a presigned PUT URL
 * 2. Server validates auth and generates a unique object key
 * 3. Client uploads file bytes directly to S3
 * 4. Client confirms to the server, which stores the key in PostgreSQL
 *
 * Serving flow:
 * 1. Server generates imgproxy URLs from stored S3 keys
 * 2. Browser requests the imgproxy URL
 * 3. imgproxy fetches from S3, resizes/converts, and returns the image
 */

import { createHmac } from 'node:crypto'
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getS3Bucket, getS3PublicEndpoint, s3Client, s3PublicClient } from './s3-client.server'
import { extractKeyFromUrl, isExternalImageUrl } from './image-url'

export { extractKeyFromUrl, isExternalImageUrl }

const PRESIGNED_URL_EXPIRY_SECONDS = 300 // 5 minutes

const ALLOWED_KEY_PREFIXES = ['products/', 'shops/'] as const
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export class ImageStorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageStorageError'
  }
}

function validateKey(key: string): void {
  if (!key || key.length > 512) {
    throw new ImageStorageError('Invalid image key: empty or too long')
  }

  const hasAllowedPrefix = ALLOWED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
  if (!hasAllowedPrefix) {
    throw new ImageStorageError(
      `Invalid image key: must start with one of [${ALLOWED_KEY_PREFIXES.join(', ')}]`,
    )
  }

  // Prevent directory traversal or malformed keys
  if (key.includes('..') || key.includes('//') || key.startsWith('/')) {
    throw new ImageStorageError('Invalid image key: malformed path')
  }
}

function validateContentType(contentType: string): void {
  if (!ALLOWED_CONTENT_TYPES.includes(contentType as (typeof ALLOWED_CONTENT_TYPES)[number])) {
    throw new ImageStorageError(
      `Invalid content type: ${contentType}. Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
    )
  }
}

/**
 * Generates a unique S3 object key for a new image.
 */
export function generateImageKey(prefix: 'products' | 'shops', extension: string): string {
  const ext = extension.replace(/^\./, '')
  const id = crypto.randomUUID()
  return `${prefix}/${id}.${ext}`
}

/**
 * Creates a presigned PUT URL that allows the browser to upload
 * directly to S3 without passing bytes through our server.
 */
export async function createPresignedUploadUrl(key: string, contentType: string): Promise<string> {
  validateKey(key)
  validateContentType(contentType)

  const command = new PutObjectCommand({
    Bucket: getS3Bucket(),
    Key: key,
    ContentType: contentType,
  })

  // Sign with the public-endpoint client so the browser can resolve the URL
  // and the signature matches the Host header the browser will send.
  return getSignedUrl(s3PublicClient, command, {
    expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
  })
}

/**
 * Downloads an image from a URL and uploads it directly to S3 as the given key.
 * Used by seed scripts to import placeholder images into platform storage.
 */
export async function uploadImageFromUrl(imageUrl: string, targetKey: string): Promise<void> {
  validateKey(targetKey)

  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to download image from ${imageUrl}: ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get('content-type') || 'image/jpeg'

  await s3Client.send(
    new PutObjectCommand({
      Bucket: getS3Bucket(),
      Key: targetKey,
      Body: buffer,
      ContentType: contentType,
    }),
  )
}

/**
 * Deletes an object from S3.
 */
export async function deleteImageFromStorage(key: string): Promise<void> {
  validateKey(key)

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: getS3Bucket(),
      Key: key,
    }),
  )
}

/* -------------------------------------------------------------------------- */
/*                               Imgproxy URLs                                */
/* -------------------------------------------------------------------------- */

function getImgproxyBaseUrl(): string {
  return process.env.IMGPROXY_BASE_URL ?? ''
}

function getImgproxyKey(): string {
  return process.env.IMGPROXY_KEY ?? ''
}

function getImgproxySalt(): string {
  return process.env.IMGPROXY_SALT ?? ''
}

function signImgproxyPath(path: string): string {
  const key = getImgproxyKey()
  const salt = getImgproxySalt()

  if (!key || !salt) {
    // Unsigned URLs for development
    return `/insecure${path}`
  }

  const hmac = createHmac('sha256', Buffer.from(key, 'hex'))
  hmac.update(Buffer.from(salt, 'hex'))
  hmac.update(Buffer.from(path, 'utf8'))
  const signature = hmac.digest('base64url')

  return `/${signature}${path}`
}

export interface ImgproxyOptions {
  width?: number
  height?: number
  format?: 'webp' | 'avif' | 'jpeg' | 'png'
  quality?: number
}

/**
 * Builds an imgproxy URL for an S3 object key.
 *
 * In development, returns unsigned imgproxy URLs.
 * In production, returns signed imgproxy URLs to prevent open-proxy abuse.
 */
export function buildImgproxyUrl(key: string, options: ImgproxyOptions = {}): string {
  const baseUrl = getImgproxyBaseUrl()
  if (!baseUrl) {
    // Fallback: return a direct S3 URL if imgproxy is not configured
    const endpoint = getS3PublicEndpoint()
    const bucket = getS3Bucket()
    return `${endpoint}/${bucket}/${key}`
  }

  const processingOptions: string[] = []

  if (options.width) {
    processingOptions.push(`w:${options.width}`)
  }
  if (options.height) {
    processingOptions.push(`h:${options.height}`)
  }
  if (options.format) {
    processingOptions.push(`f:${options.format}`)
  }
  if (options.quality) {
    processingOptions.push(`q:${options.quality}`)
  }

  const optionsPath = processingOptions.length > 0 ? `/${processingOptions.join('/')}` : ''
  const sourcePath = `/plain/s3://${getS3Bucket()}/${key}`
  const fullPath = `${optionsPath}${sourcePath}`

  const signedPath = signImgproxyPath(fullPath)
  return `${baseUrl}${signedPath}`
}

/**
 * Builds a direct S3 URL for cases where imgproxy is not needed
 * (e.g., admin previews, downloads).
 */
export function buildS3PublicUrl(key: string): string {
  const endpoint = getS3PublicEndpoint()
  const bucket = getS3Bucket()
  return `${endpoint}/${bucket}/${key}`
}
