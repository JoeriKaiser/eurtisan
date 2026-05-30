import { describe, expect, it } from 'vitest'
import { getImageUrl } from './image-url'

describe('getImageUrl', () => {
  it('returns empty string for empty key', () => {
    expect(getImageUrl('')).toBe('')
  })

  it('returns full URLs as-is', () => {
    expect(getImageUrl('http://example.com/image.jpg')).toBe('http://example.com/image.jpg')
  })

  it('builds imgproxy URL with width', () => {
    const url = getImageUrl('products/abc.jpg', { width: 400 })
    expect(url).toContain('w:400')
    expect(url).toContain('products/abc.jpg')
    expect(url).not.toContain('%2F')
  })

  it('builds imgproxy URL with webp format', () => {
    const url = getImageUrl('products/abc.jpg', { width: 400, format: 'webp' })
    expect(url).toContain('w:400')
    expect(url).toContain('f:webp')
    expect(url).toContain('products/abc.jpg')
  })

  it('builds imgproxy URL without options', () => {
    const url = getImageUrl('products/abc.jpg')
    expect(url).toContain('plain/s3://')
    expect(url).toContain('products/abc.jpg')
  })
})
