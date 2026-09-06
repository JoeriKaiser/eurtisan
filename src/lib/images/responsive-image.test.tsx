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
    expect(srcset).toContain('products%2Fabc.jpg')
    expect(srcset).toContain('width=400')
    expect(srcset).toContain('width=800')
    expect(srcset).toContain('format=webp')
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

  it('renders CSS shimmer placeholder when placeholder is blur and image is not loaded', () => {
    const { container } = render(
      <ResponsiveImage src='products/bowl.jpg' alt='Bowl' placeholder='blur' />,
    )
    const shimmer = container.querySelector('.animate-pulse')
    expect(shimmer).toBeDefined()
    expect(shimmer?.getAttribute('aria-hidden')).toBe('true')
    const images = container.querySelectorAll('img')
    // Must only contain the main image, no secondary blur thumbnail img tag
    expect(images.length).toBe(1)
  })

  it('uses explicitly provided srcset prop instead of calling buildSrcset', () => {
    const customSrcset =
      'https://cdn.example.com/custom-400.webp 400w, https://cdn.example.com/custom-800.webp 800w'
    render(<ResponsiveImage src='products/vase.jpg' alt='Custom vase' srcset={customSrcset} />)

    const image = screen.getByAltText('Custom vase')
    expect(image.getAttribute('srcset')).toBe(customSrcset)
  })

  it('passes fetchPriority to the img element', () => {
    render(<ResponsiveImage src='products/vase.jpg' alt='Priority vase' fetchPriority='high' />)

    const image = screen.getByAltText('Priority vase')
    expect(image.getAttribute('fetchpriority')).toBe('high')
  })
})
