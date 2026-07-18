// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PublicProduct } from '#/lib/products'
import SearchResultCard from './SearchResultCard'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    children: React.ReactNode
    to: string
    className?: string
    [key: string]: unknown
  }) => (
    <a
      href={props.to as string}
      className={props.className}
      aria-label={props['aria-label'] as string}
    >
      {props.children}
    </a>
  ),
}))

function makeProduct(overrides?: Partial<PublicProduct>): PublicProduct {
  return {
    id: 'prod-1',
    name: 'Handmade Vase',
    description: 'A beautiful ceramic vase',
    slug: 'handmade-vase',
    priceCents: 2999,
    stockCount: 5,
    isActive: true,
    status: 'published',
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    categoryName: 'Pottery',
    categorySlug: 'pottery',
    shopName: 'Test Shop',
    shopSlug: 'test-shop',
    shopIsVatRegistered: false,
    imageUrl: null,
    ...overrides,
  }
}

describe('SearchResultCard', () => {
  it('renders product name', () => {
    render(<SearchResultCard product={makeProduct()} />)
    expect(screen.getByText('Handmade Vase')).toBeDefined()
  })

  it('renders price in EUR format', () => {
    render(<SearchResultCard product={makeProduct()} />)
    expect(screen.getByText('€29.99')).toBeDefined()
  })

  it('renders shop name', () => {
    render(<SearchResultCard product={makeProduct()} />)
    expect(screen.getByText('Test Shop')).toBeDefined()
  })

  it('renders product image through getImageUrl when imageUrl is provided', () => {
    render(<SearchResultCard product={makeProduct()} imageUrl='products/vase.jpg' />)
    const img = screen.getByAltText('Handmade Vase')
    expect(img.getAttribute('src')).toBe('/api/image?key=products%2Fvase.jpg&width=128&format=webp')
  })

  it('renders legacy /uploads/ image path as-is', () => {
    render(<SearchResultCard product={makeProduct()} imageUrl='/uploads/vase.jpg' />)
    const img = screen.getByAltText('Handmade Vase')
    expect(img.getAttribute('src')).toBe('/uploads/vase.jpg')
  })

  it('renders external image URL as-is', () => {
    render(<SearchResultCard product={makeProduct()} imageUrl='https://cdn.example.com/vase.jpg' />)
    const img = screen.getByAltText('Handmade Vase')
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/vase.jpg')
  })

  it('shows placeholder when no image is provided', () => {
    const { container } = render(<SearchResultCard product={makeProduct()} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('No image available')).toBeDefined()
    expect(container.querySelector('.bg-gradient-to-br')).not.toBeNull()
  })

  it('displays out-of-stock styling when stock is zero', () => {
    const { container } = render(<SearchResultCard product={makeProduct({ stockCount: 0 })} />)
    const link = container.querySelector('a')
    expect(link?.classList.contains('opacity-60')).toBe(true)
  })
})
