// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { CategoryPage } from './$slug'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockLoaderData = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
  useRouter: () => ({ navigate: mockNavigate }),
  useLoaderData: () => mockLoaderData.current,
}))

vi.mock('#/paraglide/runtime', () => ({ getLocale: () => 'en' }))

vi.mock('#/paraglide/messages', () => {
  // Explicit entries are the ones this file asserts on. Everything else — keys
  // reached through ProductGrid, ProductCard, and their children — falls back to
  // its own name, so an unrelated component adding a message cannot break these
  // tests with a TypeError.
  const explicit = {
    category_kicker: () => 'Category',
    category_description: ({ name }: { name: string }) =>
      `Browse products in the ${name} category.`,
    category_product_count: ({ count }: { count: number }) =>
      `${count} ${count === 1 ? 'product' : 'products'}`,
    category_subcategories: () => 'Subcategories',
    category_products_heading: () => 'Products',
    category_no_products: () => 'No products in this category yet.',
    category_no_filter_results: () => 'No products match these filters.',
    search_sort_label: () => 'Sort by',
    search_sort_newest: () => 'Newest',
    search_sort_price_asc: () => 'Price (Low to High)',
    search_sort_price_desc: () => 'Price (High to Low)',
    search_filter_category: () => 'Category',
    search_filter_category_all: () => 'All categories',
    search_filter_price_eur: () => 'Price (EUR)',
    search_filter_min_price: () => 'Min',
    search_filter_max_price: () => 'Max',
    search_filter_in_stock_only: () => 'In stock only',
    search_clear_filters: () => 'Clear filters',
    ranking_disclosure_title: () => 'How results are ordered',
    ranking_disclosure_category_body: () => 'Products are shown in the order you choose.',
    ranking_disclosure_no_payment: () => 'Sellers cannot pay to rank higher.',
    ranking_disclosure_search_body: () => 'Results are ordered by match quality.',
    ranking_disclosure_search_note: () => 'Spelling correction applies.',
    ranking_disclosure_search_1: () => 'Words matched.',
    ranking_disclosure_search_2: () => 'Spelling.',
    ranking_disclosure_search_3: () => 'Proximity.',
    ranking_disclosure_search_4: () => 'Which field matched.',
    ranking_disclosure_search_5: () => 'Your chosen sort.',
    ranking_disclosure_search_6: () => 'Exactness.',
    ranking_disclosure_search_7: () => 'In stock first.',
    ranking_disclosure_search_8: () => 'Review score.',
    product_grid_empty: () => 'No products',
    product_grid_loading: () => 'Loading',
    product_card_label: ({ name }: { name: string }) => `Product: ${name}`,
    product_out_of_stock: () => 'Out of stock',
    product_pagination: () => 'Pagination',
    product_unknown_shop: () => 'Unknown shop',
    vat_included: () => 'VAT included',
    vat_exempt_short: () => 'VAT exempt',
    pagination_previous: () => 'Previous',
    pagination_next: () => 'Next',
    pagination_page_of: ({ page, total }: { page: number; total: number }) =>
      `Page ${page} of ${total}`,
  }

  return {
    m: new Proxy(explicit as Record<string, unknown>, {
      get: (target, key: string) => target[key] ?? (() => key),
    }),
  }
})

function makeProduct(id: string, name: string) {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    description: null,
    priceCents: 2500,
    stockCount: 3,
    isActive: true,
    status: 'published',
    publishedAt: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    categoryName: 'Pottery',
    categorySlug: 'pottery',
    shopName: 'Test Shop',
    shopSlug: 'test-shop',
    shopIsVatRegistered: false,
    imageUrl: null,
  }
}

function setLoaderData(overrides: Record<string, unknown> = {}) {
  mockLoaderData.current = {
    category: {
      id: 'cat-1',
      name: 'Pottery',
      slug: 'pottery',
      productCount: 2,
      children: [],
      breadcrumbs: [],
    },
    products: {
      products: [makeProduct('p1', 'Vase'), makeProduct('p2', 'Bowl')],
      total: 2,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    },
    page: 1,
    sort: 'newest',
    inStockOnly: false,
    minPrice: '',
    maxPrice: '',
    ...overrides,
  }
}

/** Resolves the functional search updater so merge behaviour can be asserted. */
function resolveNavigateSearch(previous: Record<string, unknown>) {
  const call = mockNavigate.mock.calls.at(-1)?.[0]
  const reducer = call?.search as (p: Record<string, unknown>) => Record<string, unknown>
  return reducer(previous)
}

beforeEach(() => {
  mockNavigate.mockClear()
  setLoaderData()
})

describe('CategoryPage', () => {
  it('renders the category name as the only h1', () => {
    render(<CategoryPage />)
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0].textContent).toContain('Pottery')
  })

  it('localizes the headings that were hardcoded English', () => {
    setLoaderData({
      category: {
        id: 'cat-1',
        name: 'Pottery',
        slug: 'pottery',
        productCount: 2,
        children: [{ id: 'c1', name: 'Ceramics', slug: 'ceramics' }],
        breadcrumbs: [],
      },
    })
    render(<CategoryPage />)

    expect(screen.getByRole('heading', { name: 'Subcategories' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Products' })).toBeDefined()
  })

  it('pluralizes the product count through the message format', () => {
    setLoaderData({
      category: {
        id: 'cat-1',
        name: 'Pottery',
        slug: 'pottery',
        productCount: 1,
        children: [],
        breadcrumbs: [],
      },
    })
    render(<CategoryPage />)
    expect(screen.getByText('1 product')).toBeDefined()
  })

  it('hides the subcategory section when there are none', () => {
    render(<CategoryPage />)
    expect(screen.queryByRole('heading', { name: 'Subcategories' })).toBeNull()
  })

  describe('browsing controls', () => {
    it('puts the chosen sort in the URL and drops it at the default', () => {
      render(<CategoryPage />)

      fireEvent.click(screen.getByRole('button', { name: 'Price (Low to High)' }))
      expect(resolveNavigateSearch({})).toEqual({ sort: 'price_asc' })

      fireEvent.click(screen.getByRole('button', { name: 'Newest' }))
      expect(resolveNavigateSearch({ sort: 'price_asc' })).toEqual({})
    })

    it('navigates with push so the back button can undo a filter', () => {
      render(<CategoryPage />)
      fireEvent.click(screen.getByRole('button', { name: 'Price (Low to High)' }))

      const call = mockNavigate.mock.calls.at(-1)?.[0]
      expect(call?.replace).toBeUndefined()
    })

    it('keeps other filters when one changes', () => {
      render(<CategoryPage />)

      fireEvent.click(screen.getByRole('checkbox', { name: /in stock only/i }))
      // A price filter already in the URL must survive an unrelated change.
      expect(resolveNavigateSearch({ minPrice: 10 })).toEqual({ inStock: true, minPrice: 10 })
    })

    it('resets paging when a filter changes', () => {
      render(<CategoryPage />)
      fireEvent.click(screen.getByRole('checkbox', { name: /in stock only/i }))
      expect(resolveNavigateSearch({ page: 4 })).toEqual({ inStock: true })
    })

    it('commits a price on blur rather than per keystroke', () => {
      render(<CategoryPage />)
      const min = screen.getByLabelText('Min')

      fireEvent.change(min, { target: { value: '15' } })
      expect(mockNavigate).not.toHaveBeenCalled()

      fireEvent.blur(min)
      expect(resolveNavigateSearch({})).toEqual({ minPrice: 15 })
    })

    it('clears every filter but leaves paging rules intact', () => {
      setLoaderData({ sort: 'price_asc', inStockOnly: true, minPrice: '5', maxPrice: '50' })
      render(<CategoryPage />)

      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
      expect(resolveNavigateSearch({ sort: 'price_asc', inStock: true, minPrice: 5 })).toEqual({})
    })

    it('offers no controls for an empty category with no active filters', () => {
      setLoaderData({
        category: {
          id: 'cat-1',
          name: 'Pottery',
          slug: 'pottery',
          productCount: 0,
          children: [],
          breadcrumbs: [],
        },
        products: { products: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
      })
      render(<CategoryPage />)

      expect(screen.queryByRole('button', { name: 'Newest' })).toBeNull()
    })

    it('distinguishes an empty category from an over-filtered one', () => {
      setLoaderData({
        products: { products: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
      })
      render(<CategoryPage />)
      expect(screen.getByText('No products in this category yet.')).toBeDefined()

      setLoaderData({
        inStockOnly: true,
        products: { products: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
      })
      render(<CategoryPage />)
      expect(screen.getByText('No products match these filters.')).toBeDefined()
    })
  })

  describe('ranking disclosure', () => {
    it('discloses how results are ordered', () => {
      render(<CategoryPage />)
      expect(screen.getByText('How results are ordered')).toBeDefined()
    })

    it('separates the disclosure from the product cards', () => {
      render(<CategoryPage />)
      const firstProduct = screen.getByRole('heading', { name: 'Vase' }).closest('a')

      expect(firstProduct?.closest('.mt-4')).not.toBeNull()
    })

    it('states that ranking cannot be bought', () => {
      // Required by CRD 6a(1)(a) / C. consom. L.111-7, which has no micro or
      // small enterprise exemption.
      render(<CategoryPage />)
      expect(screen.getByText('Sellers cannot pay to rank higher.')).toBeDefined()
    })
  })

  describe('accessibility', () => {
    it('has no axe violations with products and controls', async () => {
      const { container } = render(<CategoryPage />)
      expect(await axe(container)).toHaveNoViolations()
    })

    it('has no axe violations for an empty category', async () => {
      setLoaderData({
        category: {
          id: 'cat-1',
          name: 'Pottery',
          slug: 'pottery',
          productCount: 0,
          children: [],
          breadcrumbs: [],
        },
        products: { products: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
      })
      const { container } = render(<CategoryPage />)
      expect(await axe(container)).toHaveNoViolations()
    })

    it('names the sort group for screen readers', () => {
      render(<CategoryPage />)
      expect(screen.getByRole('group', { name: 'Sort by' })).toBeDefined()
    })

    it('reflects the active sort as pressed state, not colour alone', () => {
      setLoaderData({ sort: 'price_asc' })
      render(<CategoryPage />)

      expect(
        screen.getByRole('button', { name: 'Price (Low to High)' }).getAttribute('aria-pressed'),
      ).toBe('true')
      expect(screen.getByRole('button', { name: 'Newest' }).getAttribute('aria-pressed')).toBe(
        'false',
      )
    })
  })
})
