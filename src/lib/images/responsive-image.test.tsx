// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSrcset, ResponsiveImage } from './responsive'

afterEach(() => {
  vi.restoreAllMocks()
})

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

  it('shows an image that completed before React attached its load handler', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(800)

    render(<ResponsiveImage src='products/loaded.jpg' alt='Handmade ceramic bowl' />)

    const image = screen.getByAltText('Handmade ceramic bowl')
    expect(image.classList.contains('opacity-100')).toBe(true)
    expect(image.classList.contains('opacity-0')).toBe(false)
  })
})
