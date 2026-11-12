// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SearchPage } from './search'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockLoaderData = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    children: React.ReactNode
    to: string
    search?: unknown
    className?: string
  }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
  useRouter: () => ({ navigate: mockNavigate }),
  useLoaderData: () => mockLoaderData.current,
}))

vi.mock('#/paraglide/runtime', () => ({ getLocale: () => 'en' }))

vi.mock('#/paraglide/messages', () => {
  const explicit: Record<string, unknown> = {
    search_explore_title: () => 'Explore handcrafted goods',
    search_results_title: ({ query }: { query: string }) => `Results for "${query}"`,
    search_results_count: ({ count }: { count: number }) => `${count} results`,
    search_objects_count: ({ count }: { count: number }) => `${count} items`,
    search_back_to_discovery: () => 'Back to discovery',
    search_surprise_me: () => 'Surprise me',
    search_no_results_title: () => 'No results found',
    search_no_results_description: ({ query }: { query: string }) =>
      `We couldn't find any products matching "${query}".`,
    search_no_filter_results_description: () => 'No products match these filters.',
    search_no_results_tip_spelling: () => 'Check the spelling of your search terms.',
    search_no_results_tip_general: () => 'Try fewer or more general words.',
    search_no_results_browse_categories: () => 'Browse categories',
    search_clear_filters: () => 'Clear filters',
    search_sort_label: () => 'Sort by',
    search_sort_relevance: () => 'Relevance',
    search_sort_price_asc: () => 'Price (Low to High)',
    search_sort_price_desc: () => 'Price (High to Low)',
    search_sort_newest: () => 'Newest',
    search_filter_category: () => 'Category',
    search_filter_category_all: () => 'All categories',
    search_filter_price_eur: () => 'Price (EUR)',
    search_filter_min_price: () => 'Min',
    search_filter_max_price: () => 'Max',
    search_filter_in_stock_only: () => 'In stock only',
    ranking_disclosure_title: () => 'How results are ordered',
    ranking_disclosure_search_body: () => 'Results are ordered by relevance.',
  }
  return {
    m: new Proxy(explicit, {
      get: (target, prop: string) => target[prop] ?? (() => prop),
    }),
  }
})

describe('SearchPage empty state', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
  })

  it('renders search suggestions and browse categories link when a query yields 0 results without filters', () => {
    mockLoaderData.current = {
      query: 'nonexistentquery123',
      products: { products: [], total: 0, totalPages: 0, facets: { categories: [] } },
      page: 1,
      categories: [],
      categorySlug: undefined,
      shopSlug: undefined,
      minPriceCents: undefined,
      maxPriceCents: undefined,
      inStockOnly: false,
      sort: 'relevance',
    }

    render(<SearchPage />)

    expect(screen.getByRole('heading', { name: 'No results found' })).toBeDefined()
    expect(
      screen.getByText('We couldn\'t find any products matching "nonexistentquery123".'),
    ).toBeDefined()
    expect(screen.getByText('Check the spelling of your search terms.')).toBeDefined()
    expect(screen.getByText('Try fewer or more general words.')).toBeDefined()

    const discoveryLinks = screen.getAllByRole('link', { name: 'Back to discovery' })
    expect(discoveryLinks.length).toBeGreaterThanOrEqual(1)
    expect(discoveryLinks[0].getAttribute('href')).toBe('/search')

    const browseCategoriesLink = screen.getByRole('link', { name: 'Browse categories' })
    expect(browseCategoriesLink.getAttribute('href')).toBe('/category/all')
  })

  it('renders clear filters action when 0 results match active filters', () => {
    mockLoaderData.current = {
      query: 'mug',
      products: { products: [], total: 0, totalPages: 0, facets: { categories: [] } },
      page: 1,
      categories: [],
      categorySlug: 'ceramics',
      shopSlug: undefined,
      minPriceCents: 500,
      maxPriceCents: 1000,
      inStockOnly: true,
      sort: 'relevance',
    }

    render(<SearchPage />)

    expect(screen.getByRole('heading', { name: 'No results found' })).toBeDefined()
    const clearFiltersLinks = screen.getAllByRole('link', { name: 'Clear filters' })
    expect(clearFiltersLinks.length).toBeGreaterThanOrEqual(1)
    expect(clearFiltersLinks[0].getAttribute('href')).toBe('/search')

    const browseCategoriesLink = screen.getByRole('link', { name: 'Browse categories' })
    expect(browseCategoriesLink.getAttribute('href')).toBe('/category/all')
  })
})
