import { Link, useRouter } from '@tanstack/react-router'
import { ArrowRight, Search } from 'lucide-react'
import { useState } from 'react'
import { getImageUrl } from '#/lib/image-url'
import { m } from '#/paraglide/messages'

interface FeaturedMakerShop {
  id: string
  name: string
  slug: string
  category: string | null
  tagline: string | null
  productCount: number
  image: string | null
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

  const handleSearch = (e: React.FormEvent) => {
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

  // Auth-aware primary CTA calculation
  let primaryLink = '/signin'
  let primaryText = m.home_hero_cta_start_selling()
  let isPrimaryRedirect = true

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
        primaryLink = `/creator?shopId=${activeShop.id}`
        primaryText = m.home_hero_cta_dashboard()
      } else if (draftShop) {
        primaryLink = `/sell/onboarding/${draftShop.id}`
        primaryText = m.home_hero_cta_continue_listing()
      } else if (pendingShop) {
        primaryLink = `/sell/status/${pendingShop.id}`
        primaryText = m.home_hero_cta_check_status()
      } else {
        primaryLink = `/creator?shopId=${sellerShops[0].id}`
        primaryText = m.home_hero_cta_dashboard()
      }
    } else {
      primaryLink = '/sell'
      primaryText = m.home_hero_cta_start_selling()
    }
  }

  const featuredShop = shops[0]
  const featuredImageSrc = featuredShop?.image
    ? getImageUrl(featuredShop.image, { width: 960, format: 'webp' })
    : '/images/hero_artisan_goods.png'

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
                className='block no-underline rounded-xl overflow-hidden border border-border-subtle shadow-xs'
              >
                <div
                  role='img'
                  aria-label={m.home_hero_image_alt()}
                  className='aspect-video w-full bg-cover bg-center sm:aspect-[5/4]'
                  style={{
                    backgroundImage: `url("${featuredImageSrc}"), url("/images/hero_artisan_goods.png")`,
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
            <div className='mb-3 inline-flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-wider text-accent-primary'>
              <span className='size-1.5 rounded-full bg-accent-primary' aria-hidden='true' />
              <span>{m.home_hero_kicker()}</span>
            </div>

            <h1 className='display-title text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-text-primary leading-[1.08]'>
              {m.home_hero_title()}
            </h1>

            <p className='mt-5 font-sans text-base sm:text-lg leading-relaxed text-text-secondary max-w-xl'>
              {m.home_hero_desc()}
            </p>

            {/* Hero Search */}
            <form
              aria-label={m.home_search_button()}
              className='mt-8 max-w-xl'
              onSubmit={handleSearch}
            >
              <div className='flex items-center rounded-xl border border-border-strong bg-surface-default shadow-xs p-1.5 focus-within:border-accent-primary focus-within:ring-2 focus-within:ring-accent-primary/20 transition-all'>
                <div className='flex items-center pl-3 text-text-muted'>
                  <Search className='size-4' aria-hidden='true' />
                </div>
                <input
                  type='search'
                  placeholder={m.home_search_placeholder()}
                  className='w-full border-0 bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-placeholder focus:outline-none'
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    if (searchError) setSearchError(false)
                  }}
                  aria-label={m.home_search_placeholder()}
                  aria-invalid={searchError}
                  aria-describedby={searchError ? 'search-error' : undefined}
                />
                <button
                  type='submit'
                  className='rounded-lg bg-accent-primary px-5 py-2.5 text-xs font-semibold text-text-on-primary hover:bg-accent-primary-hover active:bg-accent-primary-active transition-colors cursor-pointer shrink-0'
                >
                  {m.home_search_button()}
                </button>
              </div>
              {searchError && (
                <p id='search-error' className='mt-1 text-xs text-error font-medium'>
                  {m.home_search_error_empty()}
                </p>
              )}
            </form>

            {/* Actions */}
            <div className='mt-8 flex flex-wrap items-center gap-3'>
              <Link
                to={primaryLink}
                search={isPrimaryRedirect ? { redirect: '/sell' } : undefined}
                className='inline-flex items-center gap-2 rounded-lg bg-accent-primary px-6 py-3 text-xs font-semibold text-text-on-primary hover:bg-accent-primary-hover active:bg-accent-primary-active transition-colors no-underline shadow-xs'
              >
                <span>{primaryText}</span>
                <ArrowRight size={14} aria-hidden='true' />
              </Link>
              <Link
                to='/search'
                className='inline-flex items-center gap-2 rounded-lg border border-border-strong bg-surface-default px-6 py-3 text-xs font-semibold text-text-primary hover:bg-surface-inset transition-colors no-underline'
              >
                <span>{m.home_hero_cta_explore()}</span>
              </Link>
            </div>
          </div>

          {/* Right Visual Column */}
          {featuredShop && (
            <div className='hidden lg:flex lg:w-[42%]'>
              <div className='w-full rounded-2xl border border-border-subtle bg-surface-default p-4 shadow-sm'>
                <div
                  className='relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-surface-inset bg-cover bg-center'
                  style={{ backgroundImage: "url('/images/hero_artisan_goods.png')" }}
                >
                  <img
                    src={featuredImageSrc}
                    alt={featuredShop.name}
                    className='h-full w-full object-cover transition-transform duration-500 ease-out hover:scale-[1.02]'
                    onError={({ currentTarget }) => {
                      currentTarget.style.display = 'none'
                    }}
                  />
                  <div className='absolute bottom-3 left-3 rounded-lg bg-bg-base/90 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-text-primary shadow-xs'>
                    {m.home_hero_featured_maker()}
                  </div>
                </div>

                <div className='mt-4 flex items-baseline justify-between'>
                  <h3 className='display-title text-xl font-bold text-text-primary'>
                    {featuredShop.name}
                  </h3>
                  <span className='text-xs font-medium text-text-secondary'>
                    {featuredShop.productCount === 1
                      ? m.home_hero_featured_maker_product_single()
                      : m.home_hero_featured_maker_products({
                          count: String(featuredShop.productCount),
                        })}
                  </span>
                </div>
                {featuredShop.tagline && (
                  <p className='mt-1 text-xs text-text-secondary line-clamp-2 leading-relaxed'>
                    {featuredShop.tagline}
                  </p>
                )}

                <div className='mt-4 pt-3 border-t border-border-subtle flex items-center justify-between'>
                  <span className='text-xs text-text-muted'>{m.home_trust_direct()}</span>
                  <Link
                    to='/shops/$shopSlug'
                    params={{ shopSlug: featuredShop.slug }}
                    className='text-xs font-semibold text-accent-primary hover:underline inline-flex items-center gap-1'
                  >
                    <span>{m.product_visit_shop()}</span>
                    <span aria-hidden='true'>&rarr;</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
