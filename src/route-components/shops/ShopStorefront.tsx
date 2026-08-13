import { Link, useRouter } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useCallback, useRef } from 'react'
import { BrowseFilters } from '#/components/browse/BrowseFilters'
import ProductGrid from '#/components/ProductGrid'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import type { PaginatedProducts, ShopProductCategory, SortOption } from '#/lib/products.server'
import type { ShopProfile } from '#/lib/shop-profile'
import { m } from '#/paraglide/messages'
import { ShopAnnouncement } from './storefront/ShopAnnouncement'
import { ShopBanner } from './storefront/ShopBanner'
import { ShopIdentityHeader } from './storefront/ShopIdentityHeader'
import { ShopPoliciesPanel } from './storefront/ShopPoliciesPanel'
import { ShopSocialLinks } from './storefront/ShopSocialLinks'
import { ShopStoryPanel } from './storefront/ShopStoryPanel'

export interface ShopStorefrontProps {
  shop: ShopProfile
  products: PaginatedProducts
  categories: ShopProductCategory[]
  searchQuery: string
  categorySlug: string | undefined
  inStockOnly: boolean
  sort: SortOption
}

/**
 * URL params this page owns, so a partial update can clear the rest by name.
 *
 * `inStock` is a real boolean, not the string `'true'`: the router serialises
 * search values as JSON, so a string lands in the address bar as
 * `?inStock=%22true%22` — unreadable in a shared link. `shopSearchSchema`
 * accepts both on the way back in.
 */
type StorefrontSearchParams = {
  page?: number
  search?: string
  sort?: SortOption
  inStock?: true
  category?: string
}

/**
 * Public storefront for a shop.
 *
 * Every panel below the header renders only when its data is present, so a
 * sparse profile reads as deliberate rather than broken. This is the one buyer
 * surface where the brand register applies (`DESIGN.md` §1): editorial
 * typography and committed warmth, rather than the restraint used for task
 * surfaces.
 */
export default function ShopStorefront({
  shop,
  products,
  categories,
  searchQuery,
  categorySlug,
  inStockOnly,
  sort,
}: ShopStorefrontProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * Merges into the existing params instead of replacing them, so changing one
   * control never silently drops another — sorting a filtered list must not
   * clear the filter. Params at their default are omitted so a plain storefront
   * URL stays clean and canonical.
   */
  const updateSearch = useCallback(
    (overrides: StorefrontSearchParams) => {
      const reduce = (previous: Record<string, unknown>) => {
        const next: StorefrontSearchParams = {
          ...(previous as StorefrontSearchParams),
          ...overrides,
        }
        // Any filter change resets paging: page 3 of an unfiltered list is
        // rarely a valid page of the filtered one.
        if (!('page' in overrides)) next.page = undefined
        if (next.page === 1) next.page = undefined
        if (next.sort === 'newest') next.sort = undefined
        return Object.fromEntries(
          Object.entries(next).filter(([, value]) => value !== undefined && value !== ''),
        )
      }

      // `push`, not `replace`: paging and filtering are steps a buyer expects
      // the back button to undo. Applied to search, storefront, and category
      // together so browsing history behaves the same on all three.
      router.navigate({
        to: '.',
        // `to: '.'` widens the router's search type to the union of every route
        // in the app, which no single-route reducer can satisfy. The shape this
        // page actually produces is `StorefrontSearchParams`, validated on
        // arrival by `shopSearchSchema`.
        search: reduce as never,
      })
    },
    [router],
  )

  const handleSearch = useCallback(() => {
    updateSearch({ search: inputRef.current?.value.trim() || undefined })
  }, [updateSearch])

  const handlePageChange = useCallback(
    (page: number) => {
      updateSearch({ page })
    },
    [updateSearch],
  )

  const handleClearFilters = useCallback(() => {
    // Leaves the text query alone: it is the buyer's own words, not a filter
    // they picked from a list.
    updateSearch({ category: undefined, inStock: undefined, sort: undefined })
  }, [updateSearch])

  const hasProducts = products.products.length > 0
  const hasActiveFilters = Boolean(categorySlug) || inStockOnly || sort !== 'newest'
  // The seller-facing CTA belongs only to a genuinely empty shop, not to a
  // shop whose current view happens to match nothing.
  const showCta = !hasProducts && !searchQuery && !hasActiveFilters

  const emptyMessage = (() => {
    if (searchQuery) return m.shop_no_search_results()
    if (hasActiveFilters) return m.shop_no_filter_results()
    return m.shop_no_products()
  })()

  // Mirrors the render conditions in ShopStoryPanel and ShopPoliciesPanel, so
  // the in-page nav can never link to a section that did not render.
  const hasStory = Boolean(shop.description?.trim()) || shop.hasProductionPartner
  const hasPolicies = shop.policies !== null

  return (
    <main className='page-wrap px-4 pb-16 pt-8'>
      <ShopBanner shopId={shop.id} bannerImage={shop.bannerImage} avatarImage={shop.image} />

      <section className='island-shell rounded-2xl px-6 py-8 sm:px-10 sm:py-10'>
        <ShopIdentityHeader shop={shop} />
        <ShopAnnouncement announcement={shop.announcement} />
      </section>

      {/* In-page nav rather than links in the shared shop header: that header
          also wraps product-detail pages, where these sections do not exist.
          Only sections that actually rendered are linked. */}
      {(hasStory || hasPolicies) && (
        <nav
          aria-label={m.shop_products_title()}
          className='mt-4 flex flex-wrap gap-4 px-2 text-sm'
        >
          {hasStory && (
            <a href='#about' className='text-text-secondary hover:text-accent-primary'>
              {m.shop_nav_about()}
            </a>
          )}
          <a href='#products' className='text-text-secondary hover:text-accent-primary'>
            {m.shop_nav_products()}
          </a>
          {hasPolicies && (
            <a href='#policies' className='text-text-secondary hover:text-accent-primary'>
              {m.shop_nav_policies()}
            </a>
          )}
        </nav>
      )}

      <ShopStoryPanel shop={shop} />

      <section id='products' className='mt-8 scroll-mt-24'>
        <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <h2 className='text-xl font-semibold text-text-primary'>{m.shop_products_title()}</h2>
          <div className='flex gap-2'>
            <div className='relative flex-1 sm:w-64'>
              <Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted' />
              <Input
                key={searchQuery}
                ref={inputRef}
                type='search'
                placeholder={m.shop_search_placeholder()}
                defaultValue={searchQuery}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearch()
                  }
                }}
                className='pl-9'
                aria-label={m.shop_search_placeholder()}
              />
            </div>
            <Button onClick={handleSearch} variant='secondary'>
              {m.shop_search_button()}
            </Button>
          </div>
        </div>

        {/* An empty shop gets no controls: sorting nothing three ways reads as
            a broken page rather than an unstocked one. */}
        {(shop.productCount > 0 || hasActiveFilters) && (
          <BrowseFilters
            categories={categories}
            categorySlug={categorySlug}
            inStockOnly={inStockOnly}
            sort={sort}
            hasActiveFilters={hasActiveFilters}
            onChange={updateSearch}
            onClear={handleClearFilters}
          />
        )}

        <ProductGrid
          products={products.products}
          emptyMessage={emptyMessage}
          page={products.page}
          totalPages={products.totalPages}
          onPageChange={handlePageChange}
        />

        {showCta && (
          <div className='mt-8 flex justify-center'>
            <Link
              to='/'
              className='inline-flex items-center gap-2 rounded-lg bg-accent-primary px-6 py-3 text-sm font-medium text-text-on-primary no-underline transition-colors hover:bg-accent-primary-hover'
            >
              {m.shop_browse_marketplace()}
            </Link>
          </div>
        )}
      </section>

      <ShopPoliciesPanel policies={shop.policies} origin={shop.origin} />
      <ShopSocialLinks socials={shop.socials} />
    </main>
  )
}
