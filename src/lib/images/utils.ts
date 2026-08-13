import { validatePlainText } from '../xss'

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
  key: string
  altText?: string
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = dataUrl.match(/^data:([\w/]+);base64,(.+)$/)
  if (!match) {
    throw new ImageValidationError('Invalid data URL format')
  }

  const [, mimeType, base64Data] = match

  if (base64Data.length > MAX_FILE_SIZE * 1.4) {
    throw new ImageValidationError(`File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }

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

export function validateImageInput(input: { dataUrl: string; altText?: string }): {
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

  const altText = input.altText ? validatePlainText(input.altText, 'Alt text') : undefined
  return { buffer, mimeType, altText }
}

export function validateImageKey(key: string): void {
  if (!key || key.length > 512) {
    throw new ImageValidationError('Invalid image key')
  }
  if (!key.match(/^(products|shops)\/[^/]+\.(jpg|jpeg|png|webp)$/)) {
    throw new ImageValidationError('Invalid image key format')
  }
}

export function getExtensionFromMimeType(mimeType: string): string {
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
