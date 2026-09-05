import { describe, expect, it } from 'vitest'
import { getImageUrl, setServerImageSigner } from './url'

describe('getImageUrl', () => {
  it('returns empty string for empty key', () => {
    expect(getImageUrl('')).toBe('')
  })

  it('returns full URLs as-is', () => {
    expect(getImageUrl('http://example.com/image.jpg')).toBe('http://example.com/image.jpg')
  })

  it('returns legacy /uploads/ paths as-is', () => {
    expect(getImageUrl('/uploads/legacy/image.jpg')).toBe('/uploads/legacy/image.jpg')
  })

  it('builds a same-origin delivery URL with width', () => {
    expect(getImageUrl('products/abc.jpg', { width: 400 })).toBe(
      '/api/image?key=products%2Fabc.jpg&width=400',
    )
  })

  it('builds a same-origin delivery URL with WebP format', () => {
    expect(getImageUrl('products/abc.jpg', { width: 400, format: 'webp' })).toBe(
      '/api/image?key=products%2Fabc.jpg&width=400&format=webp',
    )
  })

  it('builds a same-origin delivery URL without options', () => {
    expect(getImageUrl('products/abc.jpg')).toBe('/api/image?key=products%2Fabc.jpg')
  })

  it('uses server image signer when registered and in server environment', () => {
    const originalWindow = globalThis.window
    // @ts-expect-error - simulate node environment
    delete globalThis.window
    try {
      setServerImageSigner((key, opts) => `/uploads/signed-test/${key}?w=${opts?.width ?? 'orig'}`)
      expect(getImageUrl('products/abc.jpg', { width: 400 })).toBe(
        '/uploads/signed-test/products/abc.jpg?w=400',
      )
    } finally {
      setServerImageSigner(null)
      if (originalWindow !== undefined) {
        globalThis.window = originalWindow
      }
    }
  })

  it('falls back to delivery URL if server image signer throws', () => {
    const originalWindow = globalThis.window
    // @ts-expect-error - simulate node environment
    delete globalThis.window
    try {
      setServerImageSigner(() => {
        throw new Error('signing failed')
      })
      expect(getImageUrl('products/abc.jpg', { width: 400 })).toBe(
        '/api/image?key=products%2Fabc.jpg&width=400',
      )
    } finally {
      setServerImageSigner(null)
      if (originalWindow !== undefined) {
        globalThis.window = originalWindow
      }
    }
  })
})
