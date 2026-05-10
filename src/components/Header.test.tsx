// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Header from './Header'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockUseCart = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    children: React.ReactNode
    to: string
    className?: string
    activeProps?: Record<string, string>
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

vi.mock('#/paraglide/messages', () => ({
  m: {
    nav_logo: () => 'Eurtisan',
    nav_home: () => 'Home',
    nav_about: () => 'About',
    search_header_placeholder: () => 'Search products...',
    search_header_button: () => 'Search',
    cart_badge_label: () => 'Shopping cart',
  },
}))

vi.mock('./ThemeToggle', () => ({
  default: () => <button type='button'>Theme</button>,
}))

vi.mock('./UserMenu', () => ({
  default: () => <button type='button'>User</button>,
}))

vi.mock('#/components/CartProvider', () => ({
  useCart: () => mockUseCart(),
}))

describe('Header', () => {
  beforeEach(() => {
    mockUseCart.mockReturnValue({
      cart: null,
      isLoading: false,
      refreshCart: vi.fn(),
    })
  })

  it('renders logo and navigation links', () => {
    render(<Header />)
    expect(screen.getByText('Eurtisan')).toBeDefined()
    expect(screen.getByText('Home')).toBeDefined()
    expect(screen.getByText('About')).toBeDefined()
  })

  it('renders search input with aria-label', () => {
    render(<Header />)
    const input = screen.getByLabelText('Search products...')
    expect(input).toBeDefined()
    expect(input.getAttribute('type')).toBe('search')
  })

  it('navigates to search on submit with query', () => {
    render(<Header />)
    const input = screen.getByLabelText('Search products...')
    fireEvent.change(input, { target: { value: 'vase' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/search',
      search: { q: 'vase' },
    })
  })

  it('trims whitespace from search query', () => {
    render(<Header />)
    const input = screen.getByLabelText('Search products...')
    fireEvent.change(input, { target: { value: '  vase  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/search',
      search: { q: 'vase' },
    })
  })

  it('does not navigate on empty search', () => {
    mockNavigate.mockClear()
    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('renders cart button with aria-label', () => {
    render(<Header />)
    expect(screen.getByRole('button', { name: 'Shopping cart' })).toBeDefined()
  })

  it('shows cart badge with distinct item count', () => {
    mockUseCart.mockReturnValue({
      cart: {
        id: 'cart-1',
        userId: null,
        sessionId: 'sess-1',
        expiresAt: null,
        shops: [
          {
            shopId: 'shop-1',
            shopName: 'Test Shop',
            shopSlug: 'test-shop',
            items: [
              {
                id: 'item-1',
                productId: 'prod-1',
                quantity: 2,
                product: null,
                unavailable: false,
                stockWarning: false,
              },
              {
                id: 'item-2',
                productId: 'prod-2',
                quantity: 1,
                product: null,
                unavailable: false,
                stockWarning: false,
              },
            ],
            subtotalCents: 3000,
          },
        ],
        totalCents: 3000,
        totalItems: 3,
      },
      isLoading: false,
      refreshCart: vi.fn(),
    })

    render(<Header />)
    expect(screen.getByText('2')).toBeDefined()
  })

  it('hides badge when cart is empty', () => {
    mockUseCart.mockReturnValue({
      cart: {
        id: 'cart-1',
        userId: null,
        sessionId: 'sess-1',
        expiresAt: null,
        shops: [],
        totalCents: 0,
        totalItems: 0,
      },
      isLoading: false,
      refreshCart: vi.fn(),
    })

    render(<Header />)
    expect(screen.queryByText('0')).toBeNull()
  })
})
