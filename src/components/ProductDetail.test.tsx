// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ProductDetail from './ProductDetail'
import type { ProductDetail as ProductDetailType } from '#/lib/products.server'

function makeProduct(overrides?: Partial<ProductDetailType>): ProductDetailType {
  return {
    id: 'prod-1',
    name: 'Handmade Vase',
    description: 'A beautiful ceramic vase crafted by artisans.',
    slug: 'handmade-vase',
    priceCents: 2999,
    stockCount: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    categoryName: 'Pottery',
    categorySlug: 'pottery',
    shopName: 'Artisan Studio',
    shopSlug: 'artisan-studio',
    shopDescription: 'Handcrafted goods from local artisans.',
    categoryId: 'cat-1',
    images: [
      { id: 'img-1', url: 'http://example.com/1.jpg', altText: 'Front view', sortOrder: 0 },
      { id: 'img-2', url: 'http://example.com/2.jpg', altText: 'Side view', sortOrder: 1 },
    ],
    ...overrides,
  }
}

describe('ProductDetail', () => {
  it('renders product name', () => {
    render(<ProductDetail product={makeProduct()} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Handmade Vase')
  })

  it('renders price in EUR format', () => {
    render(<ProductDetail product={makeProduct()} />)
    expect(screen.getByText('€29,99')).toBeDefined()
  })

  it('renders full description', () => {
    render(<ProductDetail product={makeProduct()} />)
    expect(screen.getByText('A beautiful ceramic vase crafted by artisans.')).toBeDefined()
  })

  it('renders stock count when in stock', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 5 })} />)
    expect(screen.getByText('5 in stock')).toBeDefined()
  })

  it('shows out-of-stock message when stock is zero', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 0 })} />)
    const badges = screen.getAllByText('Out of stock')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('renders image gallery with thumbnails', () => {
    render(<ProductDetail product={makeProduct()} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBe(2)
  })

  it('switches main image when thumbnail is clicked', () => {
    render(<ProductDetail product={makeProduct()} />)
    const tabs = screen.getAllByRole('tab')
    fireEvent.click(tabs[1])
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
    expect(tabs[0].getAttribute('aria-selected')).toBe('false')
  })

  it('shows placeholder when no images exist', () => {
    render(<ProductDetail product={makeProduct({ images: [] })} />)
    expect(screen.getByLabelText('No image available')).toBeDefined()
  })

  it('disables add-to-cart button when out of stock', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 0 })} />)
    const button = screen.getByRole('button', { name: /Out of stock/i })
    expect(button.hasAttribute('disabled')).toBe(true)
  })

  it('enables add-to-cart button when in stock', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 3 })} />)
    const button = screen.getByRole('button', { name: /Add to cart/i })
    expect(button.hasAttribute('disabled')).toBe(false)
  })

  it('increments quantity', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 5 })} />)
    const increase = screen.getByRole('button', { name: /Increase quantity/i })
    fireEvent.click(increase)
    expect(screen.getByDisplayValue('2')).toBeDefined()
  })

  it('decrements quantity', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 5 })} />)
    const increase = screen.getByRole('button', { name: /Increase quantity/i })
    const decrease = screen.getByRole('button', { name: /Decrease quantity/i })
    fireEvent.click(increase)
    fireEvent.click(decrease)
    expect(screen.getByDisplayValue('1')).toBeDefined()
  })

  it('disables quantity buttons when out of stock', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 0 })} />)
    const increase = screen.getByRole('button', { name: /Increase quantity/i })
    const decrease = screen.getByRole('button', { name: /Decrease quantity/i })
    expect(increase.hasAttribute('disabled')).toBe(true)
    expect(decrease.hasAttribute('disabled')).toBe(true)
  })

  it('renders a read-only quantity input for accessibility', () => {
    render(<ProductDetail product={makeProduct({ stockCount: 5 })} />)
    const input = screen.getByLabelText('Quantity') as HTMLInputElement
    expect(input.tagName.toLowerCase()).toBe('input')
    expect(input.readOnly).toBe(true)
  })

  it('renders shop name and description', () => {
    render(<ProductDetail product={makeProduct()} />)
    expect(screen.getByText('Artisan Studio')).toBeDefined()
    expect(screen.getByText('Handcrafted goods from local artisans.')).toBeDefined()
  })

  it('renders category name', () => {
    render(<ProductDetail product={makeProduct()} />)
    expect(screen.getByText('Pottery')).toBeDefined()
  })

  it('renders uncategorized when category is null', () => {
    render(<ProductDetail product={makeProduct({ categoryName: null })} />)
    expect(screen.getByText('Uncategorized')).toBeDefined()
  })

  it('has keyboard-accessible thumbnail buttons', () => {
    render(<ProductDetail product={makeProduct()} />)
    const tabs = screen.getAllByRole('tab')
    for (const tab of tabs) {
      expect(tab.tagName.toLowerCase()).toBe('button')
    }
  })
})
