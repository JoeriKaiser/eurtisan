import { Link, useRouter } from '@tanstack/react-router'
import { ArrowRight, MapPin, Search } from 'lucide-react'
import { useState } from 'react'
import { getImageUrl } from '#/lib/image-url'
import { m } from '#/paraglide/messages'

interface FeaturedMakerShop {
  id: string
  name: string
  slug: string
  category?: string | null
  tagline?: string | null
  description?: string | null
  productCount: number
  image: string | null
  country?: string | null
}

function getCountryName(countryCode: string | null | undefined): string | null {
  if (!countryCode) return null
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) ?? countryCode
  } catch {
    return countryCode
  }
}

interface HomeHeroSectionProps {
  user?: {
    id: string
    name: string
    email: string
    emailVerified: boolean
    image: string | null
    role: 'customer' | 'creator' | 'admin'
  } | null
  sellerShops?: Array<{
    id: string
    name: string
    slug: string
    image: string | null
    status: string
    onboardingStep: number | null
    createdAt: Date
    updatedAt: Date
    productCount: number
  }>
  shops?: FeaturedMakerShop[]
}

const DEFAULT_SELLER_SHOPS: NonNullable<HomeHeroSectionProps['sellerShops']> = []

export function HomeHeroSection({
  user = null,
  sellerShops = DEFAULT_SELLER_SHOPS,
  shops = [],
}: HomeHeroSectionProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchError, setSearchError] = useState(false)

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setSearchError(true)
      return
    }
    router.navigate({
      to: '/search',
      search: { q: trimmed },
    })
  }

  let primaryLink = '/search'
  let primaryText = m.home_hero_cta_explore()
  let isPrimaryRedirect = false

  if (user) {
    isPrimaryRedirect = false
    if (sellerShops.length > 0) {
      const activeShop = sellerShops.find((s) => s.status === 'active' || s.status === 'paused')
      const draftShop = sellerShops.find(
        (s) => s.status === 'draft' || s.status === 'changes_requested',
      )
      const pendingShop = sellerShops.find(
        (s) => s.status === 'pending_review' || s.status === 'approved' || s.status === 'rejected',
      )

      if (activeShop) {
        primaryLink = `/studio/${activeShop.id}`
        primaryText = m.home_hero_cta_dashboard()
      } else if (draftShop) {
        primaryLink = `/sell/onboarding/${draftShop.id}`
        primaryText = m.home_hero_cta_continue_listing()
      } else if (pendingShop) {
        primaryLink = `/sell/status/${pendingShop.id}`
        primaryText = m.home_hero_cta_check_status()
      } else {
        primaryLink = `/studio/${sellerShops[0].id}`
        primaryText = m.home_hero_cta_dashboard()
      }
    } else {
      primaryLink = '/sell'
      primaryText = m.home_hero_cta_start_selling()
    }
  }

  const featuredShop = shops.find((s) => s.image !== null && s.productCount > 0) ?? shops[0]
  const featuredImageSrc = featuredShop?.image
    ? getImageUrl(featuredShop.image, { width: 960, format: 'webp' })
    : '/images/hero_artisan_goods.webp'
  const bio = featuredShop?.tagline ?? featuredShop?.description
  const countryName = getCountryName(featuredShop?.country)
  return (
    <section className='border-b border-border-subtle bg-bg-base py-10 sm:py-14 lg:py-20'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between lg:gap-12'>
          {/* Mobile maker window */}
          <div className='lg:hidden mb-8'>
            {featuredShop ? (
              <Link
                to='/shops/$shopSlug'
                params={{ shopSlug: featuredShop.slug }}
                className='block no-underline rounded-xl overflow-hidden border border-border-subtle shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
              >
                <div
                  role='img'
                  aria-label={m.home_hero_image_alt()}
                  className='aspect-video w-full bg-cover bg-center sm:aspect-[5/4]'
                  style={{
                    backgroundImage: `url("${featuredImageSrc}"), url("/images/hero_artisan_goods.webp")`,
                  }}
                />
              </Link>
            ) : (
              <div className='rounded-xl overflow-hidden border border-border-subtle shadow-xs'>
                <img
                  src={featuredImageSrc}
                  alt={m.home_hero_image_alt()}
                  className='aspect-video w-full object-cover sm:aspect-[5/4]'
                />
              </div>
            )}
          </div>

          {/* Primary hero content */}
          <div className='lg:w-[55%] flex flex-col justify-center'>
            <h1 className='display-title text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-text-primary leading-[1.08]'>
              {m.home_hero_title()}
            </h1>

            <p className='mt-5 font-sans text-base sm:text-lg leading-relaxed text-text-secondary max-w-xl'>
              {m.home_hero_desc()}
            </p>

            {/* Hero Search */}
            <form onSubmit={handleSearchSubmit} className='mt-8 max-w-md w-full'>
              <div className='flex items-center rounded-xl border border-border-default bg-surface-default shadow-xs p-1.5 focus-within:border-accent-secondary focus-within:ring-2 focus-within:ring-accent-secondary/20 transition-all'>
                <div className='flex items-center pl-3 text-text-muted'>
                  <Search className='size-4' aria-hidden='true' />
                </div>
                <input
                  type='search'
                  name='search'
                  placeholder={m.home_search_placeholder()}
                  aria-label={m.home_search_placeholder()}
                  aria-invalid={searchError}
                  aria-describedby={searchError ? 'hero-search-error' : undefined}
                  className='w-full border-0 bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-placeholder focus:outline-hidden'
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    if (searchError) setSearchError(false)
                  }}
                />
                <button
                  type='submit'
                  className='rounded-lg bg-accent-primary px-5 py-2.5 text-sm font-semibold text-text-on-primary hover:bg-accent-primary-hover active:bg-accent-primary-active transition-colors cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
                >
                  {m.home_search_button()}
                </button>
              </div>
              {searchError && (
                <p
                  id='hero-search-error'
                  role='alert'
                  className='mt-2 text-xs text-error font-medium'
                >
                  {m.home_search_error_empty()}
                </p>
              )}
            </form>

            {/* Actions */}
            <div className='mt-8 flex flex-wrap items-center gap-3'>
              <Link
                to={primaryLink}
                search={isPrimaryRedirect ? { redirect: '/sell' } : undefined}
                className='inline-flex items-center gap-2 rounded-lg bg-accent-primary px-6 py-3 text-sm font-semibold text-text-on-primary hover:bg-accent-primary-hover active:bg-accent-primary-active transition-colors no-underline shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
              >
                <span>{primaryText}</span>
                <ArrowRight size={14} aria-hidden='true' />
              </Link>
              {user ? (
                <Link
                  to='/search'
                  className='inline-flex items-center gap-2 rounded-lg border border-border-strong bg-surface-default px-6 py-3 text-sm font-semibold text-text-primary hover:bg-surface-inset transition-colors no-underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
                >
                  <span>{m.home_hero_cta_explore()}</span>
                </Link>
              ) : (
                <Link
                  to='/signin'
                  search={{ redirect: '/sell' }}
                  className='inline-flex items-center gap-2 rounded-lg border border-border-strong bg-surface-default px-6 py-3 text-sm font-semibold text-text-primary hover:bg-surface-inset transition-colors no-underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
                >
                  <span>{m.home_hero_cta_start_selling()}</span>
                </Link>
              )}
            </div>
          </div>

          {/* Right Visual Column */}
          {featuredShop && (
            <div className='hidden lg:flex lg:w-[42%] lg:justify-end'>
              <div className='w-full max-w-md rounded-2xl border border-border-subtle bg-surface-default overflow-hidden shadow-xs'>
                <div className='aspect-[16/10] w-full overflow-hidden bg-surface-inset'>
                  <img
                    src={featuredImageSrc}
                    alt={featuredShop.name}
                    className='h-full w-full object-cover transition-transform duration-500 ease-out hover:scale-[1.02]'
                    onError={({ currentTarget }) => {
                      currentTarget.style.display = 'none'
                    }}
                  />
                </div>

                <div className='p-5 sm:p-6'>
                  <div className='flex items-center justify-between gap-2 mb-3'>
                    <span className='inline-flex items-center rounded-full bg-accent-primary-subtle px-2.5 py-0.5 text-xs font-semibold text-accent-primary'>
                      {m.home_hero_newest_maker()}
                    </span>
                    {countryName && (
                      <span className='inline-flex items-center gap-1 text-xs font-medium text-text-secondary'>
                        <MapPin className='size-3.5 text-accent-secondary' aria-hidden='true' />
                        <span>{countryName}</span>
                      </span>
                    )}
                  </div>

                  <div className='flex items-baseline justify-between gap-2'>
                    <h3 className='display-title text-xl font-bold text-text-primary'>
                      {featuredShop.name}
                    </h3>
                    <span className='text-xs font-medium text-text-secondary shrink-0'>
                      {featuredShop.productCount === 1
                        ? m.home_hero_featured_maker_product_single()
                        : m.home_hero_featured_maker_products({
                            count: String(featuredShop.productCount),
                          })}
                    </span>
                  </div>

                  {bio && (
                    <p className='mt-2 text-xs sm:text-sm text-text-secondary line-clamp-2 leading-relaxed'>
                      {bio}
                    </p>
                  )}

                  <div className='mt-5 pt-4 border-t border-border-subtle flex items-center justify-between'>
                    <span className='text-xs text-text-muted'>{m.home_trust_direct()}</span>
                    <Link
                      to='/shops/$shopSlug'
                      params={{ shopSlug: featuredShop.slug }}
                      className='text-xs font-semibold text-accent-primary hover:underline inline-flex items-center gap-1 rounded-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
                    >
                      <span>{m.product_visit_shop()}</span>
                      <ArrowRight className='size-3.5' aria-hidden='true' />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
