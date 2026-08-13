// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import type { PaginatedProducts, PublicProduct } from '#/lib/products'
import type { ShopProfile } from '#/lib/shop-profile'
import ShopStorefront, { type ShopStorefrontProps } from './ShopStorefront'

const mockNavigate = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
  useRouter: () => ({ navigate: mockNavigate }),
}))

vi.mock('#/paraglide/runtime', () => ({ getLocale: () => 'en' }))

vi.mock('#/paraglide/messages', () => ({
  m: {
    shop_kicker: () => 'Shop',
    shop_products_title: () => 'Products',
    shop_nav_about: () => 'About',
    shop_nav_policies: () => 'Policies',
    shop_nav_products: () => 'Products',
    shop_search_placeholder: () => 'Search products...',
    shop_search_button: () => 'Search',
    shop_no_search_results: () => 'No products match your search.',
    shop_no_products: () => 'No products yet',
    shop_no_filter_results: () => 'No products match these filters.',
    search_sort_label: () => 'Sort by',
    search_sort_newest: () => 'Newest',
    search_sort_price_asc: () => 'Price (Low to High)',
    search_sort_price_desc: () => 'Price (High to Low)',
    search_filter_category: () => 'Category',
    search_filter_category_all: () => 'All categories',
    search_filter_in_stock_only: () => 'In stock only',
    search_clear_filters: () => 'Clear filters',
    shop_browse_marketplace: () => 'Browse the marketplace',
    shop_about_heading: () => 'About the maker',
    shop_policies_heading: () => 'Shop policies',
    shop_socials_heading: () => 'Find this maker',
    shop_announcement_label: () => 'Announcement',
    shop_link_new_tab: () => 'opens in a new tab',
    shop_member_since: ({ date }: { date: string }) => `On Eurtisan since ${date}`,
    shop_languages_label: () => 'Speaks',
    shop_production_handmade: () => 'Handmade',
    shop_production_vintage: () => 'Vintage',
    shop_production_supplies: () => 'Craft supplies',
    shop_production_mixed: () => 'Mixed',
    shop_production_partner_heading: () => 'Made with a production partner',
    shop_ships_from: ({ country }: { country: string }) => `Ships from ${country}`,
    shop_processing_time: ({ min, max }: { min: number; max: number }) =>
      `Dispatches in ${min}-${max} business days`,
    shop_ships_international: () => 'Ships internationally',
    shop_ships_domestic_only: ({ country }: { country: string }) => `Ships within ${country} only`,
    shop_returns_accepted: ({ days }: { days: number }) => `Returns accepted within ${days} days`,
    shop_returns_accepted_no_window: () => 'Returns accepted',
    shop_returns_not_accepted: () => 'No returns offered',
    shop_exchanges_accepted: ({ days }: { days: number }) =>
      `Exchanges accepted within ${days} days`,
    shop_exchanges_accepted_no_window: () => 'Exchanges accepted',
    shop_exchanges_not_accepted: () => 'No exchanges offered',
    shop_custom_orders_accepted: () => 'Takes custom orders',
    shop_custom_orders_not_accepted: () => 'No custom orders',
    shop_policies_additional: () => 'Also good to know',
    shop_policies_statutory_rights: () =>
      "Whatever a shop's own policy says, your statutory rights as an EU consumer still apply.",
    shop_product_count: ({ count }: { count: number }) => `${count} products`,
    shop_review_count: ({ count }: { count: number }) => `${count} reviews`,
    shop_social_website: () => 'Website',
    shop_social_instagram: () => 'Instagram',
    shop_social_facebook: () => 'Facebook',
    shop_social_twitter: () => 'X',
    shop_social_tiktok: () => 'TikTok',
    shop_social_pinterest: () => 'Pinterest',
    shop_social_youtube: () => 'YouTube',
    rating_out_of_five: ({ rating }: { rating: number }) => `${rating} out of 5 stars`,
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
    vat_included: () => 'VAT incl.',
    vat_exempt_short: () => 'VAT exempt',
    trader_status_trader: () => 'This seller has declared that they are a trader.',
    trader_status_non_trader: () => 'This seller has declared that they are not a trader.',
    trader_status_non_trader_rights_notice: () =>
      'Consumer rights stemming from EU consumer protection law do not apply to the contract.',
    trader_status_undeclared: () =>
      'This seller has not declared whether they are a trader. Purchases are unavailable until the declaration is provided.',
  },
}))

/** A shop that has filled in nothing beyond the required fields. */
function makeShop(overrides?: Partial<ShopProfile>): ShopProfile {
  return {
    id: 'shop-1',
    name: 'Test Shop',
    slug: 'test-shop',
    tagline: null,
    description: 'A test shop description',
    category: null,
    tags: [],
    image: null,
    bannerImage: null,
    announcement: null,
    productionType: null,
    hasProductionPartner: false,
    productionPartnerDetails: null,
    languages: [],
    isVatRegistered: false,
    traderStatus: 'trader',
    createdAt: new Date('2026-01-15T00:00:00Z'),
    policies: null,
    origin: null,
    socials: [],
    rating: null,
    productCount: 0,
    ...overrides,
  }
}

/** A shop with every publishable field populated. */
function makeCompleteShop(overrides?: Partial<ShopProfile>): ShopProfile {
  return makeShop({
    tagline: 'Slow-made stoneware',
    bannerImage: 'shops/banner.webp',
    image: 'shops/avatar.webp',
    announcement: 'Closed for the summer break until August.',
    productionType: 'handmade',
    hasProductionPartner: true,
    productionPartnerDetails: 'Glazing is done by a partner kiln in Porto.',
    languages: ['en', 'nl'],
    origin: {
      country: 'FR',
      processingTimeDays: { min: 2, max: 5 },
      shipsInternational: true,
    },
    policies: {
      returns: { accepted: true, windowDays: 14, conditions: 'Unused items only' },
      exchanges: { accepted: false },
      customOrders: { accepted: true, details: 'Ask for a quote' },
      additionalInfo: 'Ships from Toulouse',
      mandatoryRightsAcknowledged: true,
    },
    socials: [
      { platform: 'instagram', url: 'https://insta.example/atelier' },
      { platform: 'website', url: 'https://atelier.example' },
    ],
    rating: { reviewCount: 12, ratingAverage: 4.7 },
    productCount: 8,
    ...overrides,
  })
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
    weightGrams: null,
    volumeMl: null,
    soldBy: null,
    ...overrides,
  }
}

function makePaginatedProducts(overrides?: Partial<PaginatedProducts>): PaginatedProducts {
  return { products: [], total: 0, page: 1, pageSize: 12, totalPages: 0, ...overrides }
}

function renderShop(
  shop: ShopProfile,
  products = makePaginatedProducts(),
  searchQuery = '',
  browsing: Partial<
    Pick<ShopStorefrontProps, 'categories' | 'categorySlug' | 'inStockOnly' | 'sort'>
  > = {},
) {
  return render(
    <ShopStorefront
      shop={shop}
      products={products}
      searchQuery={searchQuery}
      categories={browsing.categories ?? []}
      categorySlug={browsing.categorySlug}
      inStockOnly={browsing.inStockOnly ?? false}
      sort={browsing.sort ?? 'newest'}
    />,
  )
}

/**
 * Resolves the functional `search` updater the component hands to the router,
 * against the params a page would already be carrying. Asserting the resolved
 * object rather than the function is what proves a control merges into the
 * existing URL instead of replacing it.
 */
function resolveNavigateSearch(previous: Record<string, unknown> = {}) {
  const call = mockNavigate.mock.calls.at(-1)?.[0] as {
    to: string
    search: (previous: Record<string, unknown>) => Record<string, unknown>
    replace?: boolean
  }
  expect(call.to).toBe('.')
  // Pushes rather than replaces: paging and filtering are steps a buyer expects
  // the back button to undo. Applied to search, storefront, and category
  // together so browsing history behaves the same on all three.
  expect(call.replace).toBeUndefined()
  return call.search(previous)
}

describe('ShopStorefront', () => {
  describe('identity and products (behaviour preserved from ShopPage)', () => {
    it('renders shop name and description', () => {
      renderShop(makeShop())
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Test Shop')
      expect(screen.getByText('A test shop description')).toBeDefined()
    })

    it('renders shop name without description when null', () => {
      renderShop(makeShop({ description: null }))
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Test Shop')
      expect(screen.queryByText('A test shop description')).toBeNull()
    })

    it('discloses a trader declaration from the public shop profile', () => {
      renderShop(makeShop({ traderStatus: 'trader' }))

      expect(screen.getByText('This seller has declared that they are a trader.')).toBeDefined()
      expect(
        screen.queryByText(
          'Consumer rights stemming from EU consumer protection law do not apply to the contract.',
        ),
      ).toBeNull()
    })

    it('discloses a non-trader declaration and its scoped consumer-rights consequence', () => {
      renderShop(makeShop({ traderStatus: 'non_trader' }))

      expect(screen.getByText('This seller has declared that they are not a trader.')).toBeDefined()
      expect(
        screen.getByText(
          'Consumer rights stemming from EU consumer protection law do not apply to the contract.',
        ),
      ).toBeDefined()
    })

    it('renders the shop avatar with the featured-card shared-element name', () => {
      const { container } = renderShop(makeShop({ image: 'http://example.com/shop.jpg' }))
      const image = container.querySelector("img[src='http://example.com/shop.jpg']")
      expect(image?.getAttribute('alt')).toBe('')
      expect(image?.parentElement?.style.getPropertyValue('view-transition-name')).toBe(
        'shop-image-shop-1',
      )
    })

    it('renders products in grid', () => {
      const products = makePaginatedProducts({
        products: [makeProduct('1'), makeProduct('2')],
        total: 2,
        totalPages: 1,
      })
      renderShop(makeShop(), products)
      expect(screen.getByText('Product 1')).toBeDefined()
      expect(screen.getByText('Product 2')).toBeDefined()
    })

    it('shows empty message when no products', () => {
      renderShop(makeShop())
      expect(screen.getByText('No products yet')).toBeDefined()
    })

    it('shows search empty message when search has no results', () => {
      renderShop(makeShop(), makePaginatedProducts(), 'vase')
      expect(screen.getByText('No products match your search.')).toBeDefined()
    })

    it('shows browse marketplace CTA for empty shop', () => {
      renderShop(makeShop())
      expect(screen.getByText('Browse the marketplace')).toBeDefined()
    })

    it('does not show browse marketplace CTA for empty search results', () => {
      renderShop(makeShop(), makePaginatedProducts(), 'xyz')
      expect(screen.queryByText('Browse the marketplace')).toBeNull()
    })

    it('shows pagination when multiple pages', () => {
      const products = makePaginatedProducts({
        products: [makeProduct('1')],
        total: 13,
        totalPages: 2,
        page: 1,
      })
      renderShop(makeShop(), products)
      expect(screen.getByText('Page 1 of 2')).toBeDefined()
      expect(screen.getByLabelText('Previous')).toBeDefined()
      expect(screen.getByLabelText('Next')).toBeDefined()
    })

    it('calls router.navigate on search button click', () => {
      mockNavigate.mockClear()
      renderShop(makeShop())
      fireEvent.change(screen.getByLabelText('Search products...'), { target: { value: 'vase' } })
      fireEvent.click(screen.getByText('Search'))
      expect(resolveNavigateSearch()).toEqual({ search: 'vase' })
    })

    it('calls router.navigate on Enter key in search input', () => {
      mockNavigate.mockClear()
      renderShop(makeShop())
      const input = screen.getByLabelText('Search products...')
      fireEvent.change(input, { target: { value: 'bowl' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(resolveNavigateSearch()).toEqual({ search: 'bowl' })
    })

    it('calls router.navigate on page change', () => {
      mockNavigate.mockClear()
      const products = makePaginatedProducts({
        products: [makeProduct('1')],
        total: 13,
        totalPages: 2,
        page: 1,
      })
      renderShop(makeShop(), products)
      fireEvent.click(screen.getByLabelText('Next'))
      expect(resolveNavigateSearch()).toEqual({ page: 2 })
    })

    it('preserves search query when paginating', () => {
      mockNavigate.mockClear()
      const products = makePaginatedProducts({
        products: [makeProduct('1')],
        total: 13,
        totalPages: 2,
        page: 1,
      })
      renderShop(makeShop(), products, 'vase')
      fireEvent.click(screen.getByLabelText('Next'))
      expect(resolveNavigateSearch({ search: 'vase' })).toEqual({ page: 2, search: 'vase' })
    })

    it('clears search when empty query is submitted', () => {
      mockNavigate.mockClear()
      renderShop(makeShop(), makePaginatedProducts(), 'vase')
      fireEvent.change(screen.getByLabelText('Search products...'), { target: { value: '' } })
      fireEvent.click(screen.getByText('Search'))
      expect(resolveNavigateSearch({ search: 'vase' })).toEqual({})
    })

    it('has accessible search input', () => {
      renderShop(makeShop())
      expect(screen.getByLabelText('Search products...')).toBeDefined()
    })
  })

  describe('sparse profiles degrade rather than break', () => {
    it('renders no maker panels when nothing is filled in', () => {
      renderShop(makeShop({ description: null }))
      expect(screen.queryByText('About the maker')).toBeNull()
      expect(screen.queryByText('Shop policies')).toBeNull()
      expect(screen.queryByText('Find this maker')).toBeNull()
      expect(screen.queryByLabelText('Announcement')).toBeNull()
    })

    it('renders no banner image when none is set', () => {
      const { container } = renderShop(makeShop())
      expect(container.querySelector('img')).toBeNull()
    })

    it('still renders the products section', () => {
      renderShop(makeShop({ description: null }))
      expect(screen.getByRole('heading', { name: 'Products' })).toBeDefined()
    })
  })

  describe('complete profiles surface what onboarding collected', () => {
    it('renders every maker panel', () => {
      renderShop(makeCompleteShop())
      expect(screen.getByText('About the maker')).toBeDefined()
      expect(screen.getByText('Shop policies')).toBeDefined()
      expect(screen.getByText('Find this maker')).toBeDefined()
      expect(screen.getByText('Closed for the summer break until August.')).toBeDefined()
    })

    it('renders the tagline, production type, origin, and processing time', () => {
      renderShop(makeCompleteShop())
      expect(screen.getByText('Slow-made stoneware')).toBeDefined()
      expect(screen.getByText('Handmade')).toBeDefined()
      expect(screen.getByText('Ships from France')).toBeDefined()
      expect(screen.getByText('Dispatches in 2-5 business days')).toBeDefined()
    })

    it('discloses the production partner plainly', () => {
      renderShop(makeCompleteShop())
      expect(screen.getByText('Made with a production partner')).toBeDefined()
      expect(screen.getByText('Glazing is done by a partner kiln in Porto.')).toBeDefined()
    })

    it('omits the production-partner disclosure when there is no partner', () => {
      renderShop(makeCompleteShop({ hasProductionPartner: false }))
      expect(screen.queryByText('Made with a production partner')).toBeNull()
    })

    it('uses the banner as the hero image', () => {
      const { container } = renderShop(makeCompleteShop())
      const images = Array.from(container.querySelectorAll('img'))
      expect(images.length).toBeGreaterThanOrEqual(2)
      expect(images.every((img) => img.getAttribute('alt') === '')).toBe(true)
    })
  })

  describe('policies', () => {
    it('renders the statutory-rights notice whenever policies are shown', () => {
      renderShop(makeCompleteShop())
      expect(
        screen.getByText(
          "Whatever a shop's own policy says, your statutory rights as an EU consumer still apply.",
        ),
      ).toBeDefined()
    })

    it('renders the statutory-rights notice even when the shop refuses returns', () => {
      const complete = makeCompleteShop()
      if (!complete.policies) throw new Error('fixture is expected to carry policies')
      renderShop(
        makeCompleteShop({
          policies: {
            ...complete.policies,
            returns: { accepted: false },
            exchanges: { accepted: false },
          },
        }),
      )
      expect(screen.getByText('No returns offered')).toBeDefined()
      expect(
        screen.getByText(
          "Whatever a shop's own policy says, your statutory rights as an EU consumer still apply.",
        ),
      ).toBeDefined()
    })
  })

  describe('social links', () => {
    it('marks external links as untrusted user content opening in a new tab', () => {
      renderShop(makeCompleteShop())
      const link = screen.getByRole('link', { name: /Instagram/ })
      expect(link.getAttribute('rel')).toBe('nofollow ugc noopener noreferrer')
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('href')).toBe('https://insta.example/atelier')
    })

    it('drops a javascript: URL at render even if one reaches the component', () => {
      renderShop(
        makeCompleteShop({
          // The parser would never emit this URL; the point is to prove the
          // component guards at render too, not only at read time.
          socials: [{ platform: 'website', url: 'javascript:alert(1)' }],
        }),
      )
      expect(screen.queryByRole('link', { name: /Website/ })).toBeNull()
    })

    it('hides the panel when every link is unsafe', () => {
      renderShop(
        makeCompleteShop({
          // biome-ignore lint/suspicious/noExplicitAny: see above.
          socials: [{ platform: 'website', url: 'javascript:alert(1)' } as any],
        }),
      )
      expect(screen.queryByText('Find this maker')).toBeNull()
    })
  })

  describe('rating', () => {
    it('shows the average and review count above the threshold', () => {
      renderShop(makeCompleteShop())
      expect(screen.getByText('4.7')).toBeDefined()
      expect(screen.getByText('12 reviews')).toBeDefined()
    })

    it('falls back to the product count when there is no rating', () => {
      renderShop(makeShop({ productCount: 8 }))
      expect(screen.getByText('8 products')).toBeDefined()
    })
  })

  describe('browsing controls', () => {
    const categories = [
      { id: 'c1', name: 'Ceramics', slug: 'ceramics' },
      { id: 'c2', name: 'Textiles', slug: 'textiles' },
    ]
    const stocked = makeShop({ productCount: 8 })

    it('hides the controls entirely for a shop with no products', () => {
      renderShop(makeShop({ productCount: 0 }))
      expect(screen.queryByText('Sort by')).toBeNull()
      expect(screen.queryByLabelText('In stock only')).toBeNull()
    })

    it('shows the controls once the shop has products', () => {
      renderShop(stocked)
      expect(screen.getByText('Sort by')).toBeDefined()
      expect(screen.getByText('In stock only')).toBeDefined()
    })

    it('offers the category filter only when the shop spans more than one category', () => {
      renderShop(stocked, makePaginatedProducts(), '', { categories: [categories[0]] })
      expect(screen.queryByLabelText('Category')).toBeNull()

      renderShop(stocked, makePaginatedProducts(), '', { categories })
      expect(screen.getByLabelText('Category')).toBeDefined()
    })

    it('lists only the shop’s own categories', () => {
      renderShop(stocked, makePaginatedProducts(), '', { categories })
      const options = Array.from(
        (screen.getByLabelText('Category') as HTMLSelectElement).options,
      ).map((option) => option.value)
      expect(options).toEqual(['', 'ceramics', 'textiles'])
    })

    it('puts a chosen category in the URL and resets paging', () => {
      mockNavigate.mockClear()
      renderShop(stocked, makePaginatedProducts(), '', { categories })
      fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'textiles' } })
      expect(resolveNavigateSearch({ page: 3 })).toEqual({ category: 'textiles' })
    })

    it('keeps the text query when a filter changes', () => {
      mockNavigate.mockClear()
      renderShop(stocked, makePaginatedProducts(), 'vase', { categories })
      fireEvent.click(screen.getByLabelText('In stock only'))
      expect(resolveNavigateSearch({ search: 'vase' })).toEqual({
        search: 'vase',
        inStock: true,
      })
    })

    it('keeps an active filter when the sort changes', () => {
      mockNavigate.mockClear()
      renderShop(stocked, makePaginatedProducts(), '', { categories, categorySlug: 'ceramics' })
      fireEvent.click(screen.getByText('Price (Low to High)'))
      expect(resolveNavigateSearch({ category: 'ceramics' })).toEqual({
        category: 'ceramics',
        sort: 'price_asc',
      })
    })

    it('omits the default sort from the URL', () => {
      mockNavigate.mockClear()
      renderShop(stocked, makePaginatedProducts(), '', { categories, sort: 'price_desc' })
      fireEvent.click(screen.getByText('Newest'))
      expect(resolveNavigateSearch({ sort: 'price_desc' })).toEqual({})
    })

    it('marks the active sort for assistive technology', () => {
      renderShop(stocked, makePaginatedProducts(), '', { sort: 'price_asc' })
      expect(screen.getByText('Price (Low to High)').getAttribute('aria-pressed')).toBe('true')
      expect(screen.getByText('Newest').getAttribute('aria-pressed')).toBe('false')
    })

    it('unchecks in-stock by clearing the param rather than sending false', () => {
      mockNavigate.mockClear()
      renderShop(stocked, makePaginatedProducts(), '', { inStockOnly: true })
      fireEvent.click(screen.getByLabelText('In stock only'))
      expect(resolveNavigateSearch({ inStock: true })).toEqual({})
    })

    it('offers a clear action only while a filter is active', () => {
      renderShop(stocked)
      expect(screen.queryByText('Clear filters')).toBeNull()

      renderShop(stocked, makePaginatedProducts(), '', { inStockOnly: true })
      expect(screen.getByText('Clear filters')).toBeDefined()
    })

    it('clearing drops the filters but keeps the buyer’s own words', () => {
      mockNavigate.mockClear()
      renderShop(stocked, makePaginatedProducts(), 'vase', {
        categories,
        categorySlug: 'ceramics',
        inStockOnly: true,
        sort: 'price_asc',
      })
      fireEvent.click(screen.getByText('Clear filters'))
      expect(
        resolveNavigateSearch({
          search: 'vase',
          category: 'ceramics',
          inStock: true,
          sort: 'price_asc',
        }),
      ).toEqual({ search: 'vase' })
    })

    it('distinguishes no-results-for-filters from an empty shop', () => {
      renderShop(stocked, makePaginatedProducts(), '', { inStockOnly: true })
      expect(screen.getByText('No products match these filters.')).toBeDefined()
      expect(screen.queryByText('No products yet')).toBeNull()
    })

    it('prefers the search empty state when both a query and a filter are set', () => {
      renderShop(stocked, makePaginatedProducts(), 'vase', { inStockOnly: true })
      expect(screen.getByText('No products match your search.')).toBeDefined()
    })

    it('does not show the seller CTA when a filter emptied the list', () => {
      renderShop(makeShop({ productCount: 0 }), makePaginatedProducts(), '', { inStockOnly: true })
      expect(screen.queryByText('Browse the marketplace')).toBeNull()
    })
  })

  describe('document structure', () => {
    it('has exactly one h1 and it is the shop name', () => {
      renderShop(makeCompleteShop())
      const h1s = screen.getAllByRole('heading', { level: 1 })
      expect(h1s).toHaveLength(1)
      expect(h1s[0].textContent).toBe('Test Shop')
    })

    it('has exactly one main landmark', () => {
      const { container } = renderShop(makeCompleteShop())
      expect(container.querySelectorAll('main')).toHaveLength(1)
    })

    it('has section headings below the h1', () => {
      renderShop(makeCompleteShop())
      expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0)
    })
  })
})

/**
 * Part of the `make test-accessibility` gate — see `docs/ACCESSIBILITY_ASSURANCE.md`.
 *
 * Both ends of the profile range are scanned because they render different
 * markup, not different content: the sparse shop drops whole panels and the
 * in-page nav, so an association that only breaks when a section is absent
 * would survive a populated-only scan.
 */
describe('ShopStorefront accessibility', () => {
  const categories = [
    { id: 'c1', name: 'Ceramics', slug: 'ceramics' },
    { id: 'c2', name: 'Textiles', slug: 'textiles' },
  ]

  it('has no axe violations for a fully populated shop', async () => {
    const { container } = renderShop(
      makeCompleteShop(),
      makePaginatedProducts({
        products: [makeProduct('1'), makeProduct('2')],
        total: 2,
        totalPages: 1,
      }),
      '',
      { categories },
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('has no axe violations for a shop that filled in nothing', async () => {
    const { container } = renderShop(makeShop())
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('has no axe violations when a filter emptied the grid', async () => {
    const { container } = renderShop(makeCompleteShop(), makePaginatedProducts(), '', {
      categories,
      categorySlug: 'ceramics',
      inStockOnly: true,
      sort: 'price_asc',
    })
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('names the browsing controls without relying on placement', () => {
    renderShop(makeCompleteShop(), makePaginatedProducts(), '', { categories })
    // A group rather than a bare div, so the three sort buttons are announced
    // as one choice instead of three unrelated toggles.
    expect(screen.getByRole('group', { name: 'Sort by' })).toBeDefined()
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeDefined()
    expect(screen.getByRole('checkbox', { name: 'In stock only' })).toBeDefined()
  })

  it('exposes the current sort as pressed state rather than colour alone', () => {
    renderShop(makeCompleteShop(), makePaginatedProducts(), '', { sort: 'price_desc' })
    const buttons = screen.getAllByRole('button', { pressed: false })
    expect(buttons.map((b) => b.textContent)).toContain('Newest')
    expect(screen.getByRole('button', { pressed: true }).textContent).toBe('Price (High to Low)')
  })
})
