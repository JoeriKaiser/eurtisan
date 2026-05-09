// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ProductGrid from './ProductGrid'
import type { PublicProduct } from '#/lib/products'

function makeProduct(id: string, overrides?: Partial<PublicProduct>): PublicProduct {
  return {
    id,
    name: `Product ${id}`,
    description: `Description ${id}`,
    slug: `product-${id}`,
    priceCents: 1000,
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

describe('ProductGrid', () => {
  it('renders products in a grid', () => {
    const products = [makeProduct('1'), makeProduct('2'), makeProduct('3')]
    render(<ProductGrid products={products} />)

    expect(screen.getByText('Product 1')).toBeDefined()
    expect(screen.getByText('Product 2')).toBeDefined()
    expect(screen.getByText('Product 3')).toBeDefined()
  })

  it('shows empty message when no products', () => {
    render(<ProductGrid products={[]} />)
    expect(screen.getByText('No products found.')).toBeDefined()
  })

  it('shows custom empty message when provided', () => {
    render(<ProductGrid products={[]} emptyMessage='Nothing here' />)
    expect(screen.getByText('Nothing here')).toBeDefined()
  })

  it('shows loading skeletons when isLoading is true', () => {
    const { container } = render(<ProductGrid products={[]} isLoading />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.getByText('Loading products...')).toBeDefined()
  })

  it('does not show pagination when only one page', () => {
    const products = [makeProduct('1')]
    render(<ProductGrid products={products} page={1} totalPages={1} onPageChange={vi.fn()} />)

    expect(screen.queryByText('Page 1 of 1')).toBeNull()
  })

  it('shows pagination controls when multiple pages', () => {
    const products = [makeProduct('1')]
    render(<ProductGrid products={products} page={2} totalPages={3} onPageChange={vi.fn()} />)

    expect(screen.getByText('Page 2 of 3')).toBeDefined()
    expect(screen.getByLabelText('Previous')).toBeDefined()
    expect(screen.getByLabelText('Next')).toBeDefined()
  })

  it('disables previous button on first page', () => {
    const products = [makeProduct('1')]
    render(<ProductGrid products={products} page={1} totalPages={3} onPageChange={vi.fn()} />)

    const prevButton = screen.getByLabelText('Previous')
    expect(prevButton.hasAttribute('disabled')).toBe(true)
  })

  it('disables next button on last page', () => {
    const products = [makeProduct('1')]
    render(<ProductGrid products={products} page={3} totalPages={3} onPageChange={vi.fn()} />)

    const nextButton = screen.getByLabelText('Next')
    expect(nextButton.hasAttribute('disabled')).toBe(true)
  })

  it('calls onPageChange when clicking next', () => {
    const onPageChange = vi.fn()
    const products = [makeProduct('1')]
    render(<ProductGrid products={products} page={1} totalPages={3} onPageChange={onPageChange} />)

    fireEvent.click(screen.getByLabelText('Next'))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('calls onPageChange when clicking previous', () => {
    const onPageChange = vi.fn()
    const products = [makeProduct('1')]
    render(<ProductGrid products={products} page={2} totalPages={3} onPageChange={onPageChange} />)

    fireEvent.click(screen.getByLabelText('Previous'))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('uses semantic grid container', () => {
    const products = [makeProduct('1')]
    const { container } = render(<ProductGrid products={products} />)
    const grid = container.querySelector('.grid.sm\\:grid-cols-2.lg\\:grid-cols-3')
    expect(grid).not.toBeNull()
  })
})
