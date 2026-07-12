import { describe, expect, it } from 'vitest'
import {
  getExtensionFromMimeType,
  ImageValidationError,
  validateImageInput,
  validateImageKey,
} from './utils'

describe('validateImageInput', () => {
  const createValidPng = () => {
    // Minimal 1x1 PNG
    const base64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
    return `data:image/png;base64,${base64}`
  }

  it('accepts a valid PNG data URL', () => {
    const dataUrl = createValidPng()
    const result = validateImageInput({ dataUrl })
    expect(result.mimeType).toBe('image/png')
    expect(result.buffer.length).toBeGreaterThan(0)
  })

  it('throws for invalid data URL format', () => {
    expect(() => validateImageInput({ dataUrl: 'not-a-data-url' })).toThrow(ImageValidationError)
    expect(() => validateImageInput({ dataUrl: 'not-a-data-url' })).toThrow(
      'Invalid data URL format',
    )
  })

  it('throws for disallowed MIME types', () => {
    const dataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    expect(() => validateImageInput({ dataUrl })).toThrow(ImageValidationError)
    expect(() => validateImageInput({ dataUrl })).toThrow('Invalid file type')
  })

  it('throws for base64 payload exceeding length guard before decoding', () => {
    // 5MB * 1.4 = 7MB base64 string should be rejected before Buffer.from
    const hugeBase64 = 'A'.repeat(8 * 1024 * 1024)
    const dataUrl = `data:image/png;base64,${hugeBase64}`
    expect(() => validateImageInput({ dataUrl })).toThrow(ImageValidationError)
    expect(() => validateImageInput({ dataUrl })).toThrow('File too large')
  })

  it('throws for decoded buffer exceeding MAX_FILE_SIZE', () => {
    // Base64 length under the 1.4x guard but decoded buffer over 5MB
    // 5MB buffer = ~6.67MB base64. Use 6.8MB base64 (under 7MB guard) to produce >5MB buffer.
    const payloadBase64Len = Math.floor(5.5 * 1024 * 1024 * 4) / 3
    const hugeBase64 = 'A'.repeat(Math.floor(payloadBase64Len))
    const dataUrl = `data:image/png;base64,${hugeBase64}`
    expect(() => validateImageInput({ dataUrl })).toThrow(ImageValidationError)
    expect(() => validateImageInput({ dataUrl })).toThrow('File too large')
  })

  it('throws for mismatched magic bytes', () => {
    // Valid base64 but not a real image
    const dataUrl = 'data:image/png;base64,aGVsbG8gd29ybGQ='
    expect(() => validateImageInput({ dataUrl })).toThrow(ImageValidationError)
    expect(() => validateImageInput({ dataUrl })).toThrow(
      'File content does not match declared type',
    )
  })

  it('throws for dangerous alt text', () => {
    const dataUrl = createValidPng()
    expect(() => validateImageInput({ dataUrl, altText: '<script>alert(1)</script>' })).toThrow()
  })

  it('returns trimmed alt text for safe input', () => {
    const dataUrl = createValidPng()
    const result = validateImageInput({ dataUrl, altText: '  A nice photo  ' })
    expect(result.altText).toBe('A nice photo')
  })
})

describe('validateImageKey', () => {
  it('accepts a valid products key', () => {
    expect(() => validateImageKey('products/abc123.jpg')).not.toThrow()
  })

  it('accepts a valid shops key', () => {
    expect(() => validateImageKey('shops/shop-1.webp')).not.toThrow()
  })

  it('throws for empty key', () => {
    expect(() => validateImageKey('')).toThrow(ImageValidationError)
  })

  it('throws for key exceeding max length', () => {
    expect(() => validateImageKey(`products/${'a'.repeat(506)}.png`)).toThrow(ImageValidationError)
  })

  it('throws for invalid prefix', () => {
    expect(() => validateImageKey('users/abc.jpg')).toThrow(ImageValidationError)
  })

  it('throws for invalid extension', () => {
    expect(() => validateImageKey('products/abc.gif')).toThrow(ImageValidationError)
  })
})

describe('getExtensionFromMimeType', () => {
  it('returns jpg for image/jpeg', () => {
    expect(getExtensionFromMimeType('image/jpeg')).toBe('jpg')
  })

  it('returns png for image/png', () => {
    expect(getExtensionFromMimeType('image/png')).toBe('png')
  })

  it('returns webp for image/webp', () => {
    expect(getExtensionFromMimeType('image/webp')).toBe('webp')
  })

  it('throws for unsupported mime type', () => {
    expect(() => getExtensionFromMimeType('image/gif')).toThrow('Unsupported mime type: image/gif')
  })
})
