// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MobileNavDrawer from './MobileNavDrawer'

const mockNavigate = vi.fn()
const mockOnClose = vi.fn()
const mockSetLocale = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    children: React.ReactNode
    to: string
    className?: string
    onClick?: () => void
    [key: string]: unknown
  }) => (
    <a
      href={props.to}
      className={props.className}
      onClick={() => {
        if (props.onClick) props.onClick()
      }}
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
    nav_categories: () => 'Categories',
    nav_profile: () => 'Profile',
    nav_account: () => 'Account',
    account_orders: () => 'Orders',
    notifications_title: () => 'Notifications',
    nav_start_selling: () => 'Start Selling',
    nav_my_shop: () => 'My Shop',
    nav_settings: () => 'Settings',
    nav_sign_out: () => 'Sign out',
    nav_sign_in: () => 'Sign in',
    search_header_placeholder: () => 'Search products...',
  },
}))

vi.mock('#/paraglide/runtime', () => ({
  getLocale: () => 'en',
  locales: ['en', 'fr'],
  setLocale: (locale: string) => mockSetLocale(locale),
}))

vi.mock('./ThemeToggle', () => ({
  default: () => <button type='button'>Theme Toggle Button</button>,
}))

vi.mock('#/lib/auth-hooks', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('#/lib/auth-client', () => ({
  authClient: {
    signOut: vi.fn(() => Promise.resolve()),
  },
}))

const mockOnOpenSearch = vi.fn()

function renderDrawer(
  isOpen: boolean,
  categories: Array<{ id: string; name: string; slug: string }> = [],
) {
  return render(
    <MobileNavDrawer
      isOpen={isOpen}
      onClose={mockOnClose}
      categories={categories}
      onOpenSearch={mockOnOpenSearch}
    />,
  )
}

describe('MobileNavDrawer', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockOnClose.mockClear()
    mockOnOpenSearch.mockClear()
    mockSetLocale.mockClear()
    mockUseAuth.mockReturnValue({
      user: null,
      isPending: false,
      isAuthenticated: false,
    })
  })

  it('renders nothing when closed', () => {
    renderDrawer(false)
    expect(screen.queryByText('Eurtisan')).toBeNull()
    expect(screen.queryByText('Home')).toBeNull()
  })

  it('renders correctly when open', () => {
    renderDrawer(true)
    expect(screen.getByText('Eurtisan')).toBeDefined()
    expect(screen.getByText('Home')).toBeDefined()
    expect(screen.getByText('About')).toBeDefined()
    expect(screen.getByText('Theme Toggle Button')).toBeDefined()
  })

  it('calls onClose when close button is clicked', () => {
    renderDrawer(true)
    const closeBtn = screen.getByRole('button', { name: 'Close menu' })
    fireEvent.click(closeBtn)
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when home or about links are clicked', () => {
    renderDrawer(true)
    const homeLink = screen.getByRole('link', { name: 'Home' })
    fireEvent.click(homeLink)
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('renders categories collapsible when categories are available', () => {
    const categories = [{ id: '1', name: 'Ceramics', slug: 'ceramics' }]
    renderDrawer(true, categories)
    const trigger = screen.getByRole('button', { name: 'Categories' })
    expect(trigger).toBeDefined()
    expect(screen.queryByText('Ceramics')).toBeNull()

    // Expand categories
    fireEvent.click(trigger)
    const catLink = screen.getByRole('link', { name: 'Ceramics' })
    expect(catLink).toBeDefined()

    // Click category link
    fireEvent.click(catLink)
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('allows changing language and closes drawer', () => {
    renderDrawer(true)
    const frButton = screen.getByRole('button', { name: 'fr' })
    expect(frButton).toBeDefined()

    fireEvent.click(frButton)
    expect(mockSetLocale).toHaveBeenCalledWith('fr')
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('renders authenticated user details and links', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'John Artisan',
        email: 'john@eurtisan.local',
        role: 'creator',
      },
      isPending: false,
      isAuthenticated: true,
    })

    renderDrawer(true)

    expect(screen.getByText('John Artisan')).toBeDefined()
    expect(screen.getByText('john@eurtisan.local')).toBeDefined()
    expect(screen.getByText('Profile')).toBeDefined()
    expect(screen.getByText('My Shop')).toBeDefined()
    expect(screen.getByText('Sign out')).toBeDefined()
  })

  it('calls onClose and onOpenSearch when search button trigger is clicked', () => {
    renderDrawer(true)
    const searchBtn = screen.getByRole('button', { name: 'Search products...' })
    expect(searchBtn).toBeDefined()

    fireEvent.click(searchBtn)
    expect(mockOnOpenSearch).toHaveBeenCalledTimes(1)
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })
})
