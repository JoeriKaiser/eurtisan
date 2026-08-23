// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SearchPage } from './search'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: ReactNode; to: string }) => <a href={props.to}>{props.children}</a>,
  useLoaderData: () => ({
    query: '',
    page: 1,
    products: { products: [], total: 0, totalPages: 1, facets: {} },
    categories: [],
    categorySlug: undefined,
    shopSlug: undefined,
    minPriceCents: undefined,
    maxPriceCents: undefined,
    inStockOnly: false,
    sort: 'relevance',
  }),
  useRouter: () => ({ navigate: mockNavigate }),
}))

vi.mock('./search/SearchFilters', () => ({
  SearchFilters: ({
    navigateWithParams,
  }: {
    navigateWithParams: (overrides: Record<string, string | number | undefined>) => void
  }) => (
    <button type='button' onClick={() => navigateWithParams({ minPrice: '14,50', page: 1 })}>
      apply-min-price
    </button>
  ),
}))

vi.mock('#/components/ProductGrid', () => ({ default: () => null }))
vi.mock('#/components/browse/RankingDisclosure', () => ({ RankingDisclosure: () => null }))
vi.mock('./search/DiscoveryWall', () => ({ DiscoveryWall: () => null }))

vi.mock('#/paraglide/messages', () => ({
  m: {
    search_explore_title: () => 'Explore',
    search_results_title: (_args: { query: string }) => 'Results',
    search_surprise_me: () => 'Surprise me',
    search_back_to_discovery: () => 'Back to discovery',
    search_filter_category: () => 'Category',
    search_filter_category_all: () => 'All',
    search_objects_count: (_args: { count: number }) => 'Objects',
    search_results_count: (_args: { count: number }) => 'Results count',
    search_sort_label: () => 'Sort',
    search_sort_relevance: () => 'Relevance',
    search_sort_price_asc: () => 'Price ascending',
    search_sort_price_desc: () => 'Price descending',
    search_sort_newest: () => 'Newest',
    search_no_results_title: () => 'No results',
    search_no_results_description: (_args: { query: string }) => 'No results description',
    search_no_filter_results_description: () => 'No results for these filters',
    search_clear_filters: () => 'Clear filters',
    product_pagination: () => 'Pagination',
    pagination_previous: () => 'Previous',
    pagination_next: () => 'Next',
    pagination_page_of: (_args: { page: number; totalPages: number }) => 'Page of',
  },
}))

describe('SearchPage price filters', () => {
  it('builds cent-exact search params from comma decimal prices', () => {
    render(<SearchPage />)

    fireEvent.click(screen.getByRole('button', { name: 'apply-min-price' }))

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/search',
      search: expect.objectContaining({ minPrice: 1450 }),
    })
  })
})
