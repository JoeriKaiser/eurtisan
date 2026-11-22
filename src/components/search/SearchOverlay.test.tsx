// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SearchOverlay from './SearchOverlay'

const {
  mockNavigate,
  mockSubscribe,
  mockSearchOverlay,
  mockListCategories,
  mockListTrendingSearches,
  mockTrackSearchClick,
  beforeNavigateCallbacks,
} = vi.hoisted(() => {
  const callbacks = new Set<() => void>()
  return {
    mockNavigate: vi.fn(),
    mockSubscribe: vi.fn((_event: string, fn: () => void) => {
      callbacks.add(fn)
      return () => callbacks.delete(fn)
    }),
    mockSearchOverlay: vi.fn(),
    mockListCategories: vi.fn(),
    mockListTrendingSearches: vi.fn(),
    mockTrackSearchClick: vi.fn(),
    beforeNavigateCallbacks: callbacks,
  }
})

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
    search?: unknown
    onClick?: React.MouseEventHandler<HTMLAnchorElement>
    className?: string
    [key: string]: unknown
  }) => {
    const { children, to, params, search: _search, onClick, ...rest } = props
    const href = params?.slug ? to.replace('$slug', params.slug) : to
    return (
      <a
        {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        href={href}
        onClick={(e) => {
          onClick?.(e)
          e.preventDefault()
        }}
      >
        {children}
      </a>
    )
  },
  useNavigate: () => mockNavigate,
  useRouter: () => ({
    navigate: mockNavigate,
    subscribe: mockSubscribe,
  }),
}))

vi.mock('#/lib/products/search-overlay.functions', () => ({
  searchOverlay: (...args: unknown[]) => mockSearchOverlay(...args),
}))

vi.mock('#/lib/categories', () => ({
  listCategories: (...args: unknown[]) => mockListCategories(...args),
}))

vi.mock('#/lib/products', () => ({
  listTrendingSearches: (...args: unknown[]) => mockListTrendingSearches(...args),
  trackSearchClick: (...args: unknown[]) => mockTrackSearchClick(...args),
}))

vi.mock('#/paraglide/messages', () => {
  const explicit: Record<string, (...args: never[]) => string> = {
    search_overlay_title: () => 'Search',
    search_input_placeholder: () => 'Search products...',
    search_clear_input: () => 'Clear search',
    search_browse_categories: () => 'Browse categories',
    search_categories_matching: ({ query }: { query: string }) => `Categories matching "${query}"`,
    search_results_count: ({ count }: { count: number }) => `${count} results`,
    search_view_all: () => 'View all',
    search_results_error: () => 'Could not load search results.',
    search_no_products_found: ({ query }: { query: string }) => `No products found for "${query}"`,
    search_recent_searches: () => 'Recent searches',
    search_no_recent: () => 'No recent searches',
    search_trending: () => 'Trending now',
    search_featured_collections: () => 'Featured collections',
    search_featured_summer_title: () => 'Summer picks',
    search_featured_summer_description: () => 'Seasonal goods',
    search_featured_under_price_title: ({ price }: { price: string }) => `Under ${price}`,
    search_featured_under_price_description: () => 'Thoughtful gifts',
    search_suggestions_label: () => 'Search suggestions',
    search_suggestions_products: () => 'Products',
    search_suggestions_categories: () => 'Categories',
    search_suggestion_type_query: () => 'Search',
    search_loading_suggestions: () => 'Loading suggestions',
    search_press_enter: () => 'Press Enter to search',
    search_view_all_in: ({ category }: { category: string }) => `See all in ${category}`,
    search_hint_navigate: () => 'navigate',
    search_hint_select: () => 'select',
    search_hint_close: () => 'close',
    search_no_results_tip_spelling: () => 'Check your spelling',
    search_no_results_tip_general: () => 'Try more general words',
    search_no_results_try_broader: ({ query }: { query: string }) => `Try "${query}"`,
    search_unknown_shop: () => 'Unknown shop',
    search_out_of_stock: () => 'Out of stock',
  }
  return {
    m: new Proxy(explicit, {
      get: (target, prop: string) => target[prop] ?? (() => prop),
    }),
  }
})

const PRELOADED_CATEGORIES = [
  { id: 'cat-1', name: 'Ceramics', slug: 'ceramics' },
  { id: 'cat-2', name: 'Textiles', slug: 'textiles' },
]

function renderOverlay(props?: Partial<React.ComponentProps<typeof SearchOverlay>>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  const onClose = props?.onClose ?? vi.fn()
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <SearchOverlay isOpen onClose={onClose} initialCategories={PRELOADED_CATEGORIES} {...props} />
    </QueryClientProvider>,
  )
  return { ...rendered, onClose }
}

describe('SearchOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    beforeNavigateCallbacks.clear()
    window.localStorage.clear()
    mockListCategories.mockResolvedValue(PRELOADED_CATEGORIES)
    mockListTrendingSearches.mockResolvedValue([])
    mockTrackSearchClick.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses preloaded categories without firing a redundant listCategories fetch', () => {
    renderOverlay()

    expect(screen.getByRole('link', { name: 'Ceramics' })).toBeDefined()
    expect(mockListCategories).not.toHaveBeenCalled()
  })

  it('closes when clicking a browse category chip, but stays open on Cmd-click', () => {
    const { onClose } = renderOverlay()
    const ceramicsLink = screen.getByRole('link', { name: 'Ceramics' })

    fireEvent.click(ceramicsLink, { metaKey: true })
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(ceramicsLink)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when clicking a matching category chip after typing a query', async () => {
    mockSearchOverlay.mockResolvedValueOnce({
      products: [
        {
          id: 'prod-1',
          name: 'Ceramic Mug',
          formattedName: '<em>Ceramic</em> Mug',
          description: 'Handthrown',
          slug: 'ceramic-mug',
          shopSlug: 'atelier',
          shopName: 'Atelier',
          categorySlug: 'ceramics',
          categoryName: 'Ceramics',
          priceCents: 2400,
          stockCount: 3,
          weightGrams: null,
          volumeMl: null,
          soldBy: null,
          imageUrl: null,
        },
      ],
      total: 1,
      categories: [{ slug: 'ceramics', name: 'Ceramics', count: 1 }],
    })

    const { onClose } = renderOverlay()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ceramic' } })

    const categoryLink = await screen.findByRole('link', { name: /Ceramics\s*1/i })
    fireEvent.click(categoryLink)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes and navigates on "View all" from results panel', async () => {
    mockSearchOverlay.mockResolvedValueOnce({
      products: [
        {
          id: 'prod-1',
          name: 'Ceramic Mug',
          formattedName: null,
          description: null,
          slug: 'ceramic-mug',
          shopSlug: 'atelier',
          shopName: 'Atelier',
          categorySlug: 'ceramics',
          categoryName: 'Ceramics',
          priceCents: 2400,
          stockCount: 3,
          weightGrams: null,
          volumeMl: null,
          soldBy: null,
          imageUrl: null,
        },
      ],
      total: 12,
      categories: [],
    })

    const { onClose } = renderOverlay()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ceramic' } })

    const viewAllButton = await screen.findByRole('button', { name: 'View all' })
    fireEvent.click(viewAllButton)

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/search',
      search: { q: 'ceramic' },
    })
  })

  it('closes when clicking a featured collection without double-navigating', () => {
    const { onClose } = renderOverlay()

    fireEvent.click(screen.getByRole('link', { name: /Summer picks/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('closes on router navigation events such as browser back/forward', () => {
    const { onClose } = renderOverlay()

    expect(beforeNavigateCallbacks.size).toBe(1)
    for (const cb of beforeNavigateCallbacks) cb()

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not flash "No products found" during the debounce window and cancels pending timer on Escape', () => {
    vi.useFakeTimers()
    mockSearchOverlay.mockResolvedValue({ products: [], total: 0, categories: [] })

    renderOverlay()
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'mug' } })

    // Immediately after typing, before debounce fires: must not show empty state.
    expect(screen.queryByText(/No products found/i)).toBeNull()

    // Clearing via Escape cancels the pending timer so no phantom search fires.
    fireEvent.keyDown(input, { key: 'Escape' })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(mockSearchOverlay).not.toHaveBeenCalled()
  })

  it('surfaces an error message instead of "No products found" when search fails', async () => {
    mockSearchOverlay.mockRejectedValueOnce(new Error('Rate limit exceeded'))

    renderOverlay()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ceramic' } })

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Could not load search results.')
    })
    expect(screen.queryByText(/No products found/i)).toBeNull()
  })
})
