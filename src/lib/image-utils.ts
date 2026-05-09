import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'products')
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

const JPEG_MAGIC = [0xff, 0xd8, 0xff]
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46]
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50]

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageValidationError'
  }
}

export interface ProductImageInput {
  dataUrl: string
  altText?: string
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = dataUrl.match(/^data:([\w/]+);base64,(.+)$/)
  if (!match) {
    throw new ImageValidationError('Invalid data URL format')
  }

  const [, mimeType, base64Data] = match
  const buffer = Buffer.from(base64Data, 'base64')
  return { buffer, mimeType }
}

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/webp') {
    // WebP: RIFF header at bytes 0-3, then file size at 4-7, then WEBP at 8-11
    if (buffer.length < 12) return false
    for (let i = 0; i < RIFF_MAGIC.length; i++) {
      if (buffer[i] !== RIFF_MAGIC[i]) return false
    }
    for (let i = 0; i < WEBP_MAGIC.length; i++) {
      if (buffer[8 + i] !== WEBP_MAGIC[i]) return false
    }
    return true
  }

  const magic = mimeType === 'image/jpeg' ? JPEG_MAGIC : mimeType === 'image/png' ? PNG_MAGIC : null
  if (!magic) return false

  for (let i = 0; i < magic.length; i++) {
    if (buffer[i] !== magic[i]) return false
  }
  return true
}

export function validateImageInput(input: ProductImageInput): {
  buffer: Buffer
  mimeType: string
  altText?: string
} {
  const { buffer, mimeType } = dataUrlToBuffer(input.dataUrl)

  if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new ImageValidationError(`Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`)
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new ImageValidationError(`File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }

  if (!validateMagicBytes(buffer, mimeType)) {
    throw new ImageValidationError('File content does not match declared type')
  }

  return { buffer, mimeType, altText: input.altText }
}

function getExtensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    default:
      throw new Error(`Unsupported mime type: ${mimeType}`)
  }
}

export async function saveProductImages(
  productId: string,
  images: ProductImageInput[],
): Promise<{ url: string; altText?: string; sortOrder: number }[]> {
  if (images.length === 0) return []

  const productDir = join(UPLOAD_DIR, productId)
  await mkdir(productDir, { recursive: true })

  const results: { url: string; altText?: string; sortOrder: number }[] = []

  for (let i = 0; i < images.length; i++) {
    const { buffer, mimeType, altText } = validateImageInput(images[i])
    const ext = getExtensionFromMimeType(mimeType)
    const filename = `${crypto.randomUUID()}.${ext}`
    const filepath = join(productDir, filename)
    const url = `/uploads/products/${productId}/${filename}`

    await writeFile(filepath, buffer)
    results.push({ url, altText, sortOrder: i })
  }

  return results
}

export async function deleteProductImages(productId: string): Promise<void> {
  const productDir = join(UPLOAD_DIR, productId)
  try {
    await rm(productDir, { recursive: true, force: true })
  } catch {
    // Directory may not exist; ignore
  }
}

export function sanitizeDescription(input: string | null | undefined): string | null {
  if (!input) return null
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
