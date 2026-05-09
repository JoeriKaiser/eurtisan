// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PaginatedProducts, PublicProduct, ShopSummary } from '#/lib/products'
import ShopPage from './ShopPage'

const mockNavigate = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
  useRouter: () => ({
    navigate: mockNavigate,
  }),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    shop_kicker: () => 'Shop',
    shop_products_title: () => 'Products',
    shop_search_placeholder: () => 'Search products...',
    shop_search_button: () => 'Search',
    shop_no_search_results: () => 'No products match your search.',
    shop_no_products: () => 'No products yet',
    shop_browse_marketplace: () => 'Browse the marketplace',
    product_grid_empty: () => 'No products found.',
    product_grid_loading: () => 'Loading products...',
    pagination_previous: () => 'Previous',
    pagination_next: () => 'Next',
    pagination_page_of: ({ page, totalPages }: { page: number; totalPages: number }) =>
      `Page ${page} of ${totalPages}`,
    product_pagination: () => 'Product pagination',
    product_card_label: ({ name }: { name: string }) => `Product: ${name}`,
    product_no_image: () => 'No image available',
    product_out_of_stock: () => 'Out of stock',
    product_unknown_shop: () => 'Unknown shop',
  },
}))

function makeShop(overrides?: Partial<ShopSummary>): ShopSummary {
  return {
    id: 'shop-1',
    name: 'Test Shop',
    description: 'A test shop description',
    slug: 'test-shop',
    ...overrides,
  }
}

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

function makePaginatedProducts(overrides?: Partial<PaginatedProducts>): PaginatedProducts {
  return {
    products: [],
    total: 0,
    page: 1,
    pageSize: 12,
    totalPages: 0,
    ...overrides,
  }
}

describe('ShopPage', () => {
  it('renders shop name and description', () => {
    render(<ShopPage shop={makeShop()} products={makePaginatedProducts()} searchQuery='' />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Test Shop')
    expect(screen.getByText('A test shop description')).toBeDefined()
  })

  it('renders shop name without description when null', () => {
    render(
      <ShopPage
        shop={makeShop({ description: null })}
        products={makePaginatedProducts()}
        searchQuery=''
      />,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Test Shop')
    expect(screen.queryByText('A test shop description')).toBeNull()
  })

  it('renders products in grid', () => {
    const products = makePaginatedProducts({
      products: [makeProduct('1'), makeProduct('2')],
      total: 2,
      totalPages: 1,
    })
    render(<ShopPage shop={makeShop()} products={products} searchQuery='' />)
    expect(screen.getByText('Product 1')).toBeDefined()
    expect(screen.getByText('Product 2')).toBeDefined()
  })

  it('shows empty message when no products', () => {
    render(<ShopPage shop={makeShop()} products={makePaginatedProducts()} searchQuery='' />)
    expect(screen.getByText('No products yet')).toBeDefined()
  })

  it('shows search empty message when search has no results', () => {
    render(<ShopPage shop={makeShop()} products={makePaginatedProducts()} searchQuery='vase' />)
    expect(screen.getByText('No products match your search.')).toBeDefined()
  })

  it('shows browse marketplace CTA for empty shop', () => {
    render(<ShopPage shop={makeShop()} products={makePaginatedProducts()} searchQuery='' />)
    expect(screen.getByText('Browse the marketplace')).toBeDefined()
  })

  it('does not show browse marketplace CTA for empty search results', () => {
    render(<ShopPage shop={makeShop()} products={makePaginatedProducts()} searchQuery='xyz' />)
    expect(screen.queryByText('Browse the marketplace')).toBeNull()
  })

  it('shows pagination when multiple pages', () => {
    const products = makePaginatedProducts({
      products: [makeProduct('1')],
      total: 13,
      totalPages: 2,
      page: 1,
    })
    render(<ShopPage shop={makeShop()} products={products} searchQuery='' />)
    expect(screen.getByText('Page 1 of 2')).toBeDefined()
    expect(screen.getByLabelText('Previous')).toBeDefined()
    expect(screen.getByLabelText('Next')).toBeDefined()
  })

  it('calls router.navigate on search button click', () => {
    mockNavigate.mockClear()
    render(<ShopPage shop={makeShop()} products={makePaginatedProducts()} searchQuery='' />)
    const input = screen.getByLabelText('Search products...')
    fireEvent.change(input, { target: { value: 'vase' } })
    fireEvent.click(screen.getByText('Search'))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '.',
      search: { search: 'vase' },
      replace: true,
    })
  })

  it('calls router.navigate on Enter key in search input', () => {
    mockNavigate.mockClear()
    render(<ShopPage shop={makeShop()} products={makePaginatedProducts()} searchQuery='' />)
    const input = screen.getByLabelText('Search products...')
    fireEvent.change(input, { target: { value: 'bowl' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '.',
      search: { search: 'bowl' },
      replace: true,
    })
  })

  it('calls router.navigate on page change', () => {
    mockNavigate.mockClear()
    const products = makePaginatedProducts({
      products: [makeProduct('1')],
      total: 13,
      totalPages: 2,
      page: 1,
    })
    render(<ShopPage shop={makeShop()} products={products} searchQuery='' />)
    fireEvent.click(screen.getByLabelText('Next'))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '.',
      search: { page: 2 },
      replace: true,
    })
  })

  it('preserves search query when paginating', () => {
    mockNavigate.mockClear()
    const products = makePaginatedProducts({
      products: [makeProduct('1')],
      total: 13,
      totalPages: 2,
      page: 1,
    })
    render(<ShopPage shop={makeShop()} products={products} searchQuery='vase' />)
    fireEvent.click(screen.getByLabelText('Next'))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '.',
      search: { page: 2, search: 'vase' },
      replace: true,
    })
  })

  it('clears search when empty query is submitted', () => {
    mockNavigate.mockClear()
    render(<ShopPage shop={makeShop()} products={makePaginatedProducts()} searchQuery='vase' />)
    const input = screen.getByLabelText('Search products...')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.click(screen.getByText('Search'))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '.',
      search: {},
      replace: true,
    })
  })

  it('has accessible search input', () => {
    render(<ShopPage shop={makeShop()} products={makePaginatedProducts()} searchQuery='' />)
    expect(screen.getByLabelText('Search products...')).toBeDefined()
  })

  it('has accessible heading structure', () => {
    render(<ShopPage shop={makeShop()} products={makePaginatedProducts()} searchQuery='' />)
    expect(screen.getByRole('heading', { level: 1 })).toBeDefined()
    expect(screen.getByRole('heading', { level: 2 })).toBeDefined()
  })
})
