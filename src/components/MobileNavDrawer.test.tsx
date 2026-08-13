// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import MobileNavDrawer from './MobileNavDrawer'

const mockSetLocale = vi.fn()
const mockUseAuth = vi.fn()
const mockSignOut = vi.fn(() => Promise.resolve())
const mockNavigate = vi.fn(() => Promise.resolve())

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
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
      onClick={(event) => {
        event.preventDefault()
        props.onClick?.()
      }}
      aria-label={props['aria-label'] as string}
    >
      {props.children}
    </a>
  ),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    nav_main: () => 'Main navigation',
    nav_logo: () => 'Eurtisan',
    nav_about: () => 'About',
    nav_profile: () => 'Profile',
    account_orders: () => 'Orders',
    notifications_title: () => 'Notifications',
    nav_start_selling: () => 'Start Selling',
    nav_my_shop: () => 'My Shop',
    nav_settings: () => 'Settings',
    nav_sign_out: () => 'Sign out',
    nav_sign_in: () => 'Sign in',
    mobile_nav_label: () => 'Mobile navigation',
    mobile_nav_open: () => 'Open menu',
    mobile_nav_close: () => 'Close navigation',
    mobile_nav_search: () => 'Find an object or maker',
    mobile_nav_explore: () => 'Explore the market',
    mobile_nav_browse_crafts: () => 'Browse by craft',
    mobile_nav_view_all_categories: ({ count }: { count: number }) => `View all ${count}`,
    mobile_nav_account: () => 'Your account',
    mobile_nav_language: () => 'Language',
    mobile_nav_theme: () => 'Theme',
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
    signOut: () => mockSignOut(),
  },
}))

const mockOnOpenSearch = vi.fn()

function renderDrawer(categories: Array<{ id: string; name: string; slug: string }> = []) {
  return render(<MobileNavDrawer categories={categories} onOpenSearch={mockOnOpenSearch} />)
}

function openDrawer(categories: Array<{ id: string; name: string; slug: string }> = []) {
  const result = renderDrawer(categories)
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
  return result
}

describe('MobileNavDrawer', () => {
  beforeEach(() => {
    mockOnOpenSearch.mockClear()
    mockSetLocale.mockClear()
    mockSignOut.mockClear()
    mockNavigate.mockClear()
    mockUseAuth.mockReturnValue({
      user: null,
      isPending: false,
      isAuthenticated: false,
    })
  })

  it('renders nothing when closed', () => {
    renderDrawer()
    expect(screen.queryByText('Eurtisan')).toBeNull()
    expect(screen.queryByText('Explore the market')).toBeNull()
  })

  it('renders the full-screen market map when open', () => {
    openDrawer()

    expect(screen.getByText('Eurtisan')).toBeDefined()
    expect(screen.getByText('Explore the market')).toBeDefined()
    expect(screen.getByText('About')).toBeDefined()
    expect(screen.getByText('Start Selling')).toBeDefined()
    expect(screen.getByText('Theme Toggle Button')).toBeDefined()
    expect(screen.queryByText('Home')).toBeNull()
  })

  it('closes from the close control and primary links', async () => {
    openDrawer()

    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull(),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    fireEvent.click(screen.getByRole('link', { name: 'Explore the market' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull(),
    )
  })

  it('shows a concise category matrix and links to the complete category index', () => {
    const categories = Array.from({ length: 9 }, (_, index) => ({
      id: String(index + 1),
      name: `Craft ${index + 1}`,
      slug: `craft-${index + 1}`,
    }))

    openDrawer(categories)

    expect(screen.getByText('Browse by craft')).toBeDefined()
    expect(screen.getByRole('link', { name: 'Craft 1' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Craft 8' })).toBeDefined()
    expect(screen.queryByRole('link', { name: 'Craft 9' })).toBeNull()
    expect(screen.getByRole('link', { name: 'View all 9' })).toBeDefined()
  })

  it('allows changing language and closes navigation', async () => {
    openDrawer()

    fireEvent.click(screen.getByRole('button', { name: 'fr' }))
    expect(mockSetLocale).toHaveBeenCalledWith('fr')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull(),
    )
  })

  it('preserves authenticated account destinations', () => {
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

    openDrawer()

    expect(screen.getByText('John Artisan')).toBeDefined()
    expect(screen.getByText('john@eurtisan.local')).toBeDefined()
    expect(screen.getByText('My Shop')).toBeDefined()
    expect(screen.getByText('Profile')).toBeDefined()
    expect(screen.getByText('Orders')).toBeDefined()
    expect(screen.getByText('Notifications')).toBeDefined()
    expect(screen.getByText('Settings')).toBeDefined()
    expect(screen.getByText('Sign out')).toBeDefined()
    expect(screen.queryByText('Start Selling')).toBeNull()
  })

  it('signs out, closes the drawer, and redirects home', async () => {
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

    openDrawer()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
      expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull()
    })
  })

  it('closes and opens search from the search destination', async () => {
    openDrawer()

    fireEvent.click(screen.getByRole('button', { name: 'Find an object or maker' }))
    expect(mockOnOpenSearch).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).toBeNull(),
    )
  })

  it('has no automated accessibility violations', async () => {
    openDrawer([{ id: '1', name: 'Ceramics', slug: 'ceramics' }])

    const dialog = await screen.findByRole('dialog', { name: 'Mobile navigation' })
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    expect(await axe(dialog)).toHaveNoViolations()
  })
})
