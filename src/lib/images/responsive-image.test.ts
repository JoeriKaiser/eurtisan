import { describe, expect, it } from 'vitest'
import { buildSrcset, ResponsiveImage } from './responsive'

describe('buildSrcset', () => {
  it('generates srcset entries for each width using webp format', () => {
    const srcset = buildSrcset('products/abc.jpg', [400, 800])
    expect(srcset).toContain('products/abc.jpg')
    expect(srcset).toContain('w:400')
    expect(srcset).toContain('w:800')
    expect(srcset).toContain('f:webp')
    expect(srcset).toContain(' 400w')
    expect(srcset).toContain(' 800w')
    expect(srcset).toContain(', ')
  })
})

describe('ResponsiveImage', () => {
  it('is exported as a component', () => {
    expect(ResponsiveImage).toBeDefined()
    expect(typeof ResponsiveImage).toBe('function')
  })
})
