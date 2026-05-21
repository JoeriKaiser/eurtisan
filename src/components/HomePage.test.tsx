// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeaturedShop, RecentProduct } from '#/lib/products'
import HomePage from './HomePage'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockUseAuth = vi.hoisted(() => vi.fn())

vi.mock('#/lib/auth-hooks', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('#/lib/server-auth', () => ({
  becomeCreator: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
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
  useRouter: () => ({
    navigate: mockNavigate,
  }),
}))

vi.mock('./SearchSidebar', () => ({
  default: () => <aside data-testid='search-sidebar'>SearchSidebar</aside>,
}))

function makeCategory(id: string, name: string, slug: string) {
  return { id, name, slug, description: null, parentId: null, sortOrder: 0, createdAt: new Date() }
}

function makeProduct(id: string, overrides?: Partial<RecentProduct>): RecentProduct {
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
    image: null,
    ...overrides,
  }
}

function makeShop(id: string, overrides?: Partial<FeaturedShop>): FeaturedShop {
  return {
    id,
    name: `Shop ${id}`,
    description: 'A test shop',
    slug: `shop-${id}`,
    productCount: 3,
    ...overrides,
  }
}

describe('HomePage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      isPending: false,
    })
  })

  it('renders hero section', () => {
    render(<HomePage categories={[]} products={[]} shops={[]} />)
    expect(screen.getByText('Handmade goods from European artisans')).toBeDefined()
    expect(screen.getByLabelText('Search for handmade products')).toBeDefined()
  })

  it('renders categories when present', () => {
    const categories = [makeCategory('cat-1', 'Pottery', 'pottery')]
    render(<HomePage categories={categories} products={[]} shops={[]} />)
    expect(screen.getByText('Browse by category')).toBeDefined()
    expect(screen.getByText('Pottery')).toBeDefined()
  })

  it('hides category section when no categories exist', () => {
    render(<HomePage categories={[]} products={[]} shops={[]} />)
    expect(screen.queryByText('Browse by category')).toBeNull()
  })

  it('renders featured shops section', () => {
    const shops = [makeShop('shop-1'), makeShop('shop-2')]
    render(<HomePage categories={[]} products={[]} shops={shops} />)
    expect(screen.getByText('Featured shops')).toBeDefined()
    expect(screen.getByText('Shop shop-1')).toBeDefined()
    expect(screen.getByText('Shop shop-2')).toBeDefined()
    expect(screen.getAllByText('3 products').length).toBe(2)
  })

  it('shows singular product count for one product', () => {
    const shops = [makeShop('shop-1', { productCount: 1 })]
    render(<HomePage categories={[]} products={[]} shops={shops} />)
    expect(screen.getByText('1 product')).toBeDefined()
  })

  it('shows be the first creator CTA when no shops exist', () => {
    render(<HomePage categories={[]} products={[]} shops={[]} />)
    expect(screen.getByText('Be the first creator')).toBeDefined()
    const ctaSection = screen.getByText('Be the first creator').closest('section')
    expect(ctaSection?.textContent).toContain('Open your shop')
  })

  it('renders recent products with images', () => {
    const products = [
      makeProduct('1', {
        image: { id: 'img-1', url: 'http://example.com/1.jpg', altText: null, sortOrder: 0 },
      }),
      makeProduct('2'),
    ]
    render(<HomePage categories={[]} products={products} shops={[]} />)
    expect(screen.getByText('Fresh from the studio')).toBeDefined()
    expect(screen.getByText('Product 1')).toBeDefined()
    expect(screen.getByText('Product 2')).toBeDefined()
    const img = screen.getByAltText('Product 1') as HTMLImageElement
    expect(img.src).toBe('http://example.com/1.jpg')
  })

  it('shows empty product message with browse categories CTA', () => {
    render(<HomePage categories={[]} products={[]} shops={[]} />)
    expect(screen.getByText('No products yet')).toBeDefined()
    expect(screen.getByText('Browse categories')).toBeDefined()
  })

  it('navigates to search on valid search submit', () => {
    render(<HomePage categories={[]} products={[]} shops={[]} />)
    const input = screen.getByLabelText('Search for handmade products')
    fireEvent.change(input, { target: { value: 'vase' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/search',
      search: { q: 'vase' },
    })
  })

  it('shows validation error on empty search submit', () => {
    render(<HomePage categories={[]} products={[]} shops={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(screen.getByText('Please enter a search term')).toBeDefined()
  })

  it('clears search error when user starts typing', () => {
    render(<HomePage categories={[]} products={[]} shops={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(screen.getByText('Please enter a search term')).toBeDefined()

    const input = screen.getByLabelText('Search for handmade products')
    fireEvent.change(input, { target: { value: 'a' } })
    expect(screen.queryByText('Please enter a search term')).toBeNull()
  })

  it('trims whitespace from search query', () => {
    render(<HomePage categories={[]} products={[]} shops={[]} />)
    const input = screen.getByLabelText('Search for handmade products')
    fireEvent.change(input, { target: { value: '  vase  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/search',
      search: { q: 'vase' },
    })
  })

  it('does not show featured shops heading when shops array is empty', () => {
    render(<HomePage categories={[]} products={[]} shops={[]} />)
    expect(screen.queryByText('Featured shops')).toBeNull()
  })

  it('has accessible search input with aria-invalid on error', () => {
    render(<HomePage categories={[]} products={[]} shops={[]} />)
    const input = screen.getByLabelText('Search for handmade products')
    expect(input.getAttribute('aria-invalid')).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('renders shop cards linking to shop detail pages', () => {
    const shops = [makeShop('shop-1', { slug: 'artisan-studio' })]
    render(<HomePage categories={[]} products={[]} shops={shops} />)
    const link = screen.getByText('Shop shop-1').closest('a')
    expect(link?.getAttribute('href')).toBe('/shops/$shopSlug')
  })
})
