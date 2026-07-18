// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react'
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
    tagline: null,
    category: null,
    image: null,
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
    expect(screen.getByLabelText(/Search for handmade products/i)).toBeDefined()
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
    const featuredShopsSection = screen
      .getByRole('heading', { name: 'Featured shops' })
      .closest('section') as HTMLElement
    expect(featuredShopsSection).toBeDefined()
    expect(within(featuredShopsSection).getByText('Shop shop-1')).toBeDefined()
    expect(within(featuredShopsSection).getByText('Shop shop-2')).toBeDefined()
    expect(within(featuredShopsSection).getAllByText('3 products').length).toBe(2)
    const firstShopLink = within(featuredShopsSection).getByText('Shop shop-1').closest('a')
    const imageBoundary = firstShopLink?.querySelector<HTMLElement>('[style]')
    expect(imageBoundary?.style.getPropertyValue('view-transition-name')).toBe('shop-image-shop-1')
  })

  it('resolves an uploaded shop image key in the homepage hero', () => {
    const shops = [makeShop('shop-1', { image: 'shops/hero-shop.webp' })]
    render(<HomePage categories={[]} products={[]} shops={shops} />)

    const heroImage = screen.getByRole('img', { name: 'Shop shop-1' }) as HTMLImageElement
    expect(heroImage.src).toContain('/api/image?key=shops%2Fhero-shop.webp&width=960&format=webp')
  })

  it('shows singular product count for one product', () => {
    const shops = [makeShop('shop-1', { productCount: 1 })]
    render(<HomePage categories={[]} products={[]} shops={shops} />)
    const featuredShopsSection = screen
      .getByRole('heading', { name: 'Featured shops' })
      .closest('section') as HTMLElement
    expect(within(featuredShopsSection).getByText('1 product')).toBeDefined()
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
    const input = screen.getByLabelText(/Search for handmade products/i)
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

    const input = screen.getByLabelText(/Search for handmade products/i)
    fireEvent.change(input, { target: { value: 'a' } })
    expect(screen.queryByText('Please enter a search term')).toBeNull()
  })

  it('trims whitespace from search query', () => {
    render(<HomePage categories={[]} products={[]} shops={[]} />)
    const input = screen.getByLabelText(/Search for handmade products/i)
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
    const input = screen.getByLabelText(/Search for handmade products/i)
    expect(input.getAttribute('aria-invalid')).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('renders shop cards linking to shop detail pages', () => {
    const shops = [makeShop('shop-1', { slug: 'artisan-studio' })]
    render(<HomePage categories={[]} products={[]} shops={shops} />)
    const featuredShopsSection = screen
      .getByRole('heading', { name: 'Featured shops' })
      .closest('section') as HTMLElement
    const link = within(featuredShopsSection).getByText('Shop shop-1').closest('a')
    expect(link?.getAttribute('href')).toBe('/shops/$shopSlug')
  })

  it('renders auth-conditional CTAs for guest user', () => {
    render(<HomePage categories={[]} products={[]} shops={[]} user={null} />)
    const heroCtaLink = screen.getByText('Start Selling').closest('a')
    expect(heroCtaLink?.getAttribute('href')).toBe('/signin')

    // Check pre-footer CTA
    expect(screen.getByText('Ready to share your craft?')).toBeDefined()
    const preFooterCta = screen.getByText('Create Your Shop').closest('a')
    expect(preFooterCta?.getAttribute('href')).toBe('/signin')
  })

  it('renders auth-conditional CTAs for authenticated user with no shop', () => {
    const mockUser = {
      id: 'usr-1',
      name: 'John Doe',
      email: 'john@example.com',
      emailVerified: true,
      image: null,
      role: 'customer' as const,
    }
    render(<HomePage categories={[]} products={[]} shops={[]} user={mockUser} sellerShops={[]} />)
    const heroCtaLink = screen.getByText('Start Selling').closest('a')
    expect(heroCtaLink?.getAttribute('href')).toBe('/sell')

    const preFooterCta = screen.getByText('Manage Your Shop').closest('a')
    expect(preFooterCta?.getAttribute('href')).toBe('/sell')
  })

  it('renders auth-conditional CTAs for authenticated user with draft shop', () => {
    const mockUser = {
      id: 'usr-1',
      name: 'John Doe',
      email: 'john@example.com',
      emailVerified: true,
      image: null,
      role: 'creator' as const,
    }
    const mockSellerShops = [
      {
        id: 'shop-draft',
        name: 'My Craft Shop',
        slug: 'my-craft-shop',
        image: null,
        status: 'draft',
        onboardingStep: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        productCount: 0,
      },
    ]
    render(
      <HomePage
        categories={[]}
        products={[]}
        shops={[]}
        user={mockUser}
        sellerShops={mockSellerShops}
      />,
    )
    const heroCtaLink = screen.getByText('Continue Listing').closest('a')
    expect(heroCtaLink?.getAttribute('href')).toBe('/sell/onboarding/shop-draft')
  })

  it('renders auth-conditional CTAs for authenticated user with pending review shop', () => {
    const mockUser = {
      id: 'usr-1',
      name: 'John Doe',
      email: 'john@example.com',
      emailVerified: true,
      image: null,
      role: 'creator' as const,
    }
    const mockSellerShops = [
      {
        id: 'shop-pending',
        name: 'My Craft Shop',
        slug: 'my-craft-shop',
        image: null,
        status: 'pending_review',
        onboardingStep: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        productCount: 0,
      },
    ]
    render(
      <HomePage
        categories={[]}
        products={[]}
        shops={[]}
        user={mockUser}
        sellerShops={mockSellerShops}
      />,
    )
    const heroCtaLink = screen.getByText('Check Shop Status').closest('a')
    expect(heroCtaLink?.getAttribute('href')).toBe('/sell/status/shop-pending')
  })

  it('renders auth-conditional CTAs for authenticated user with active shop', () => {
    const mockUser = {
      id: 'usr-1',
      name: 'John Doe',
      email: 'john@example.com',
      emailVerified: true,
      image: null,
      role: 'creator' as const,
    }
    const mockSellerShops = [
      {
        id: 'shop-active',
        name: 'My Craft Shop',
        slug: 'my-craft-shop',
        image: null,
        status: 'active',
        onboardingStep: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        productCount: 5,
      },
    ]
    render(
      <HomePage
        categories={[]}
        products={[]}
        shops={[]}
        user={mockUser}
        sellerShops={mockSellerShops}
      />,
    )
    const heroCtaLink = screen.getByText('Go to Dashboard').closest('a')
    expect(heroCtaLink?.getAttribute('href')).toBe('/creator?shopId=shop-active')
  })

  it('renders value proposition strip', () => {
    render(<HomePage categories={[]} products={[]} shops={[]} />)
    expect(screen.getByText('Made in Europe')).toBeDefined()
    expect(screen.getByText('Direct from Makers')).toBeDefined()
    expect(screen.getByText('Secure Checkout')).toBeDefined()
    expect(screen.getByText('GDPR-First')).toBeDefined()
  })

  it('renders marketplace statistics', () => {
    const stats = { sellerCount: 45, productCount: 820, countryCount: 12 }
    render(<HomePage categories={[]} products={[]} shops={[]} stats={stats} />)
    expect(screen.getByText('45')).toBeDefined()
    expect(screen.getByText('820')).toBeDefined()
    expect(screen.getByText('12')).toBeDefined()
  })
})
