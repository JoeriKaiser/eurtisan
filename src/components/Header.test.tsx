// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Header from './Header'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
}

function renderWithProviders(ui: React.ReactNode) {
  const queryClient = createTestQueryClient()
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const mockNavigate = vi.fn()
const mockUseCart = vi.fn()
const mockUseAuth = vi.fn()
const mockUseUnreadNotificationCount = vi.fn()
const mockUseLocation = vi.fn(() => ({ pathname: '/about' }))
const mockUseLoaderData = vi.fn(() => ({
  categories: [] as { id: string; name: string; slug: string }[],
  user: null as unknown,
}))
const mockListCategories = vi.fn(() =>
  Promise.resolve<{ id: string; name: string; slug: string }[]>([]),
)

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
    state: {
      location: {
        pathname: mockUseLocation().pathname,
      },
    },
  }),
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockNavigate,
  getRouteApi: () => ({
    useLoaderData: () => mockUseLoaderData(),
  }),
}))

vi.mock('#/paraglide/messages', () => ({
  m: {
    nav_main: () => 'Main navigation',
    nav_logo: () => 'Eurtisan',
    nav_home: () => 'Home',
    nav_about: () => 'About',
    nav_categories: () => 'Categories',
    nav_profile: () => 'Profile',
    nav_start_selling: () => 'Start Selling',
    nav_my_shop: () => 'My Shop',
    nav_settings: () => 'Settings',
    nav_sign_out: () => 'Sign out',
    nav_sign_in: () => 'Sign in',
    search_header_placeholder: () => 'Search products...',
    search_header_button: () => 'Search',
    search_overlay_title: () => 'Search',
    search_recent_searches: () => 'Recent searches',
    search_recent_clear: () => 'Clear all',
    search_trending: () => 'Trending now',
    search_suggestions_products: () => 'Products',
    search_suggestions_categories: () => 'Categories',
    search_view_all_in: ({ category }: { category: string }) => `See all in ${category}`,
    search_press_enter: () => 'Press Enter to search',
    search_cmd_k: () => 'Cmd+K',
    search_no_recent: () => 'No recent searches',
    search_featured_collections: () => 'Featured collections',
    cart_badge_label: () => 'Shopping cart',
    cart_badge_items: ({ count }: { count: string }) => `${count} items in cart`,
    notifications_badge_label: () => 'Notifications',
    notifications_badge_unread: ({ count }: { count: string }) => `${count} unread notifications`,
  },
}))

vi.mock('#/paraglide/runtime', () => ({
  getLocale: () => 'en',
  locales: ['en', 'fr'],
  setLocale: vi.fn(),
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

vi.mock('#/lib/auth-hooks', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('#/lib/notifications-hooks', () => ({
  useUnreadNotificationCount: () => mockUseUnreadNotificationCount(),
}))

vi.mock('#/lib/categories', () => ({
  listCategories: () => mockListCategories(),
}))

vi.mock('meilisearch', () => ({
  Meilisearch: vi.fn(),
}))

vi.mock('#/lib/meilisearch-client', () => ({
  meilisearchClient: null,
  isMeilisearchClientConfigured: () => false,
  PRODUCTS_INDEX: 'products',
}))

vi.mock('./search', () => ({
  SearchOverlay: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid='search-overlay'>
        <span>Mock Search Overlay</span>
        <button type='button' onClick={onClose} aria-label='Close search'>
          Close Overlay
        </button>
      </div>
    ) : null,
}))

describe('Header', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockListCategories.mockReturnValue(Promise.resolve([]))
    mockUseLoaderData.mockReturnValue({ categories: [], user: null })
    mockUseCart.mockReturnValue({
      cart: null,
      isLoading: false,
      refreshCart: vi.fn(),
    })
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      isPending: false,
    })
    mockUseUnreadNotificationCount.mockReturnValue({
      data: { count: 0 },
      isPending: false,
    })
  })

  it('renders logo and navigation links', () => {
    renderWithProviders(<Header />)
    expect(screen.getByText('Eurtisan')).toBeDefined()
    expect(screen.getByText('Home')).toBeDefined()
    expect(screen.getByText('About')).toBeDefined()
  })

  it('renders search trigger button with aria-label', () => {
    renderWithProviders(<Header />)
    const trigger = screen.getByRole('button', { name: 'Search products...' })
    expect(trigger).toBeDefined()
  })

  it('renders cart link with aria-label', () => {
    renderWithProviders(<Header />)
    expect(screen.getByRole('link', { name: 'Shopping cart' })).toBeDefined()
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

    renderWithProviders(<Header />)
    expect(screen.getByText('2')).toBeDefined()
  })

  it('renders search trigger on homepage', () => {
    mockUseLocation.mockReturnValue({ pathname: '/' })
    renderWithProviders(<Header />)
    const trigger = screen.getByRole('button', { name: 'Search products...' })
    expect(trigger).toBeDefined()
    mockUseLocation.mockReturnValue({ pathname: '/about' })
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

    renderWithProviders(<Header />)
    expect(screen.queryByText('0')).toBeNull()
  })

  it('does not show notification bell when unauthenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      isPending: false,
    })

    renderWithProviders(<Header />)
    expect(screen.queryByRole('link', { name: 'Notifications' })).toBeNull()
  })

  it('shows notification bell when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'user-1', name: 'Test' },
      isPending: false,
    })

    renderWithProviders(<Header />)
    expect(screen.getByRole('link', { name: 'Notifications' })).toBeDefined()
  })

  it('shows unread notification count badge', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'user-1', name: 'Test' },
      isPending: false,
    })
    mockUseUnreadNotificationCount.mockReturnValue({
      data: { count: 5 },
      isPending: false,
    })

    renderWithProviders(<Header />)
    expect(screen.getByText('5')).toBeDefined()
  })

  it('hides notification badge when count is zero', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'user-1', name: 'Test' },
      isPending: false,
    })
    mockUseUnreadNotificationCount.mockReturnValue({
      data: { count: 0 },
      isPending: false,
    })

    renderWithProviders(<Header />)
    expect(screen.queryByText('0')).toBeNull()
  })

  it('caps notification badge at 99+', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { id: 'user-1', name: 'Test' },
      isPending: false,
    })
    mockUseUnreadNotificationCount.mockReturnValue({
      data: { count: 150 },
      isPending: false,
    })

    renderWithProviders(<Header />)
    expect(screen.getByText('99+')).toBeDefined()
  })

  it('shows categories dropdown when categories are available', async () => {
    mockUseLoaderData.mockReturnValue({
      categories: [
        { id: 'cat-1', name: 'Ceramics', slug: 'ceramics' },
        { id: 'cat-2', name: 'Textiles', slug: 'textiles' },
      ],
      user: null,
    })

    renderWithProviders(<Header />)
    await waitFor(() => {
      expect(screen.getByText('Categories')).toBeDefined()
    })
  })

  it('renders mobile menu trigger button and opens drawer on click', async () => {
    renderWithProviders(<Header />)
    const menuBtn = screen.getByRole('button', { name: 'Open menu' })
    expect(menuBtn).toBeDefined()
    expect(menuBtn.getAttribute('aria-expanded')).toBe('false')

    // Click trigger to open mobile drawer
    fireEvent.click(menuBtn)
    expect(screen.getByRole('dialog', { name: 'Navigation Drawer' })).toBeDefined()
  })

  it('renders mobile search button and opens search overlay on click', () => {
    renderWithProviders(<Header />)
    const searchBtn = screen.getByRole('button', { name: 'Search products' })
    expect(searchBtn).toBeDefined()

    // Click trigger to open search overlay
    fireEvent.click(searchBtn)
    expect(screen.getByTestId('search-overlay')).toBeDefined()
  })

  it('renders desktop search button and opens search overlay on click', () => {
    renderWithProviders(<Header />)
    const searchBtn = screen.getByRole('button', { name: 'Search products...' })
    expect(searchBtn).toBeDefined()

    // Click trigger to open search overlay
    fireEvent.click(searchBtn)
    expect(screen.getByTestId('search-overlay')).toBeDefined()
  })

  it('opens search overlay on / keyboard shortcut', () => {
    renderWithProviders(<Header />)
    expect(screen.queryByTestId('search-overlay')).toBeNull()

    // Press '/' key
    fireEvent.keyDown(document, { key: '/' })
    expect(screen.getByTestId('search-overlay')).toBeDefined()
  })

  it('opens search overlay on Cmd+K keyboard shortcut', () => {
    renderWithProviders(<Header />)
    expect(screen.queryByTestId('search-overlay')).toBeNull()

    // Press 'Cmd+K' key
    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    expect(screen.getByTestId('search-overlay')).toBeDefined()
  })
})
