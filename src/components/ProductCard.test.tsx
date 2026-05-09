// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PublicProduct } from '#/lib/products'
import ProductCard from './ProductCard'

function makeProduct(overrides?: Partial<PublicProduct>): PublicProduct {
  return {
    id: 'prod-1',
    name: 'Handmade Vase',
    description: 'A beautiful ceramic vase',
    slug: 'handmade-vase',
    priceCents: 2999,
    stockCount: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    categoryName: 'Pottery',
    categorySlug: 'pottery',
    shopName: 'Test Shop',
    shopSlug: 'test-shop',
    ...overrides,
  }
}

describe('ProductCard', () => {
  it('renders product name', () => {
    render(<ProductCard product={makeProduct()} />)
    expect(screen.getByText('Handmade Vase')).toBeDefined()
  })

  it('renders price in EUR format', () => {
    render(<ProductCard product={makeProduct()} />)
    expect(screen.getByText('€29,99')).toBeDefined()
  })

  it('renders shop name', () => {
    render(<ProductCard product={makeProduct()} />)
    expect(screen.getByText('Test Shop')).toBeDefined()
  })

  it('renders description when present', () => {
    render(<ProductCard product={makeProduct()} />)
    expect(screen.getByText('A beautiful ceramic vase')).toBeDefined()
  })

  it('renders product image when provided', () => {
    render(<ProductCard product={makeProduct()} imageUrl='http://example.com/vase.jpg' />)
    const img = screen.getByAltText('Handmade Vase')
    expect(img.getAttribute('src')).toBe('http://example.com/vase.jpg')
  })

  it('shows placeholder when no image is provided', () => {
    const { container } = render(<ProductCard product={makeProduct()} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('No image available')).toBeDefined()
  })

  it('displays out-of-stock badge when stock is zero', () => {
    render(<ProductCard product={makeProduct({ stockCount: 0 })} />)
    expect(screen.getByText('Out of stock')).toBeDefined()
  })

  it('reduces opacity for out-of-stock products', () => {
    const { container } = render(<ProductCard product={makeProduct({ stockCount: 0 })} />)
    const article = container.querySelector('article')
    expect(article?.classList.contains('opacity-75')).toBe(true)
  })

  it('does not show out-of-stock badge when stock is positive', () => {
    render(<ProductCard product={makeProduct({ stockCount: 3 })} />)
    expect(screen.queryByText('Out of stock')).toBeNull()
  })

  it('has accessible aria-label', () => {
    render(<ProductCard product={makeProduct()} />)
    expect(screen.getByLabelText('Product: Handmade Vase')).toBeDefined()
  })

  it('truncates long names with line-clamp', () => {
    const { container } = render(<ProductCard product={makeProduct({ name: 'A'.repeat(200) })} />)
    const heading = container.querySelector('h3')
    expect(heading?.classList.contains('line-clamp-1')).toBe(true)
  })

  it('handles unknown shop name', () => {
    render(<ProductCard product={makeProduct({ shopName: null })} />)
    expect(screen.getByText('Unknown shop')).toBeDefined()
  })
})
