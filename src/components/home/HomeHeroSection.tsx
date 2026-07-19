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
    if (trimmed.length === 0) {
      setSearchError(true)
      return
    }
    setSearchError(false)
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
      const firstShop = sellerShops[0]
      if (firstShop.status === 'draft' || firstShop.status === 'changes_requested') {
        primaryLink = `/sell/onboarding/${firstShop.id}`
        primaryText = m.home_hero_cta_continue_listing()
      } else if (
        firstShop.status === 'pending_review' ||
        firstShop.status === 'approved' ||
        firstShop.status === 'rejected'
      ) {
        primaryLink = `/sell/status/${firstShop.id}`
        primaryText = m.home_hero_cta_check_status()
      } else {
        primaryLink = `/creator?shopId=${firstShop.id}`
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
    <section className='relative overflow-hidden border-b border-border-subtle bg-bg-base pb-10 lg:pt-20 lg:pb-32'>
      {/* Background atmospheric glows */}
      <div className='pointer-events-none absolute inset-0 select-none'>
        <div className='absolute -left-20 -top-20 size-[360px] rounded-full opacity-35 radial-glow-moss dark:opacity-25' />
        <div className='absolute -bottom-20 -right-20 size-[400px] rounded-full opacity-30 radial-glow-sage dark:opacity-20' />
      </div>

      <div className='relative z-10 mx-auto max-w-7xl animate-fade-in-up lg:px-6'>
        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between lg:gap-8'>
          {/* Mobile maker window */}
          <div className='lg:hidden'>
            {featuredShop ? (
              <Link
                to='/shops/$shopSlug'
                params={{ shopSlug: featuredShop.slug }}
                className='block no-underline'
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
              <img
                src={featuredImageSrc}
                alt={m.home_hero_image_alt()}
                className='aspect-video w-full object-cover sm:aspect-[5/4]'
              />
            )}
          </div>

          {/* Primary hero content */}
          <div className='relative z-10 mx-4 -mt-10 max-w-2xl rounded-t-3xl border-t border-border-subtle bg-bg-base px-5 pt-5 pb-2 shadow-lg sm:px-7 sm:pt-7 lg:m-0 lg:w-[55%] lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none'>
            <span className='mb-4 inline-flex items-center gap-1.5 rounded-full bg-accent-primary-subtle px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-accent-primary sm:mb-6'>
              {m.home_hero_kicker()}
            </span>
            <h1 className='display-title mb-4 text-4xl font-bold leading-none tracking-tight text-text-primary sm:mb-5 sm:text-5xl lg:mb-6 lg:text-6xl lg:leading-tight xl:text-7xl'>
              {m.home_hero_title()}
            </h1>
            <p className='mb-5 max-w-lg font-sans text-sm leading-relaxed text-text-secondary sm:mb-8 sm:text-lg lg:hidden'>
              {m.home_hero_desc_mobile()}
            </p>
            <p className='mb-8 hidden max-w-lg font-sans text-lg leading-relaxed text-text-secondary lg:block'>
              {m.home_hero_desc()}
            </p>

            {/* Hero Search */}
            <form
              aria-label={m.home_search_button()}
              className='mb-8 max-w-lg block'
              onSubmit={handleSearch}
            >
              <div className='relative flex gap-2 items-center'>
                <div className='relative min-w-0 flex-1'>
                  <Search className='absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-placeholder' />
                  <input
                    type='search'
                    placeholder={m.home_search_placeholder()}
                    className={`flex h-12 min-w-0 w-full rounded-full border bg-bg-elevated px-4 pl-10 text-sm text-text-primary placeholder:text-text-placeholder transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20 disabled:cursor-not-allowed disabled:opacity-50 ${
                      searchError
                        ? 'border-error focus-visible:border-error focus-visible:ring-error/20'
                        : 'border-border-default hover:border-border-strong'
                    }`}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      if (searchError) setSearchError(false)
                    }}
                    aria-label={m.home_search_placeholder()}
                    aria-invalid={searchError}
                    aria-describedby={searchError ? 'search-error' : undefined}
                  />
                </div>
                <button
                  type='submit'
                  className='group relative flex size-12 shrink-0 items-center justify-center gap-3 rounded-full bg-accent-primary text-text-on-primary shadow-md transition-all active:scale-[0.98] active:bg-accent-primary-active cursor-pointer hover:bg-accent-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2 lg:w-auto lg:justify-between lg:pl-5 lg:pr-2'
                >
                  <span className='sr-only lg:not-sr-only'>{m.home_search_button()}</span>
                  <span className='flex size-6 rounded-full bg-scrim-subtle group-hover:bg-scrim items-center justify-center transition-transform duration-300 group-hover:scale-105'>
                    <Search className='size-3.5 text-current' />
                  </span>
                </button>
              </div>
              {/* Search validation error — absolute layout to avoid layout shift (CLS) */}
              <div className='relative min-h-[1.5rem] mt-1' aria-live='assertive'>
                {searchError && (
                  <p id='search-error' className='absolute text-xs text-error font-semibold'>
                    {m.home_search_error_empty()}
                  </p>
                )}
              </div>
            </form>

            {featuredShop && (
              <Link
                to='/shops/$shopSlug'
                params={{ shopSlug: featuredShop.slug }}
                className='mb-1 inline-flex max-w-full items-baseline gap-2 text-sm no-underline lg:hidden'
              >
                <span className='text-text-secondary'>{m.home_hero_featured_maker()}</span>
                <strong className='truncate text-text-primary'>{featuredShop.name}</strong>
              </Link>
            )}

            {/* Desktop actions and a quieter mobile seller path */}
            <div className='mt-4 flex items-center lg:mt-2 lg:flex-wrap lg:gap-4'>
              <Link
                to={primaryLink}
                search={isPrimaryRedirect ? { redirect: '/sell' } : undefined}
                className='group inline-flex items-center gap-1.5 text-sm font-semibold text-accent-primary no-underline transition-all active:scale-[0.98] lg:h-12 lg:justify-between lg:gap-3 lg:rounded-full lg:bg-accent-primary lg:pl-6 lg:pr-2 lg:text-text-on-primary lg:shadow-md lg:hover:bg-accent-primary-hover lg:active:bg-accent-primary-active'
              >
                <span>{primaryText}</span>
                <ArrowRight className='size-4 lg:hidden' aria-hidden='true' />
                <span className='hidden size-6 items-center justify-center rounded-full bg-scrim-subtle transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-[1px] lg:flex'>
                  <ArrowRight size={14} aria-hidden='true' />
                </span>
              </Link>
              <Link
                to='/search'
                className='hidden h-12 items-center rounded-full border border-border-default bg-surface-default px-6 font-semibold text-text-primary no-underline shadow-sm transition-all duration-300 hover:border-border-strong hover:bg-bg-inset hover:shadow active:scale-[0.98] lg:inline-flex'
              >
                {m.home_hero_cta_explore()}
              </Link>
            </div>
          </div>

          {/* Right Visual Column (Double-Bezel nested architecture) */}
          {featuredShop && (
            <div className='hidden lg:flex items-center justify-center lg:w-[42%]'>
              <Link
                to='/shops/$shopSlug'
                params={{ shopSlug: featuredShop.slug }}
                className='block w-full h-full cursor-pointer'
              >
                <div className='relative p-2 rounded-[2.5rem] bg-scrim-subtle border border-border-subtle shadow-xl w-full aspect-[4/3] overflow-hidden group hover:scale-[1.01] hover:shadow-2xl transition-all duration-300'>
                  <div className='relative w-full h-full overflow-hidden rounded-[calc(2.5rem-0.5rem)] bg-bg-elevated shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]'>
                    <img
                      src={featuredImageSrc}
                      alt={featuredShop.name}
                      className='w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]'
                      onError={({ currentTarget }) => {
                        currentTarget.onerror = null
                        currentTarget.src = '/images/hero_artisan_goods.png'
                      }}
                    />
                    {/* Visual glassmorphic scrim overlay */}
                    <div className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-scrim-image via-scrim-image-subtle to-transparent p-6 flex items-end justify-between pointer-events-none'>
                      <div className='text-white min-w-0'>
                        <p className='text-[9px] uppercase tracking-widest font-bold opacity-80'>
                          {m.home_hero_featured_maker()}
                        </p>
                        <h4 className='font-serif text-base font-bold tracking-wide mt-0.5 truncate'>
                          {featuredShop.name}
                        </h4>
                        {featuredShop.tagline && (
                          <p className='mt-0.5 text-xs opacity-90 truncate'>
                            {featuredShop.tagline}
                          </p>
                        )}
                      </div>
                      <span className='text-[10px] font-bold text-white bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 tracking-wide shrink-0 ml-3'>
                        {featuredShop.productCount === 1
                          ? m.home_hero_featured_maker_product_single()
                          : m.home_hero_featured_maker_products({
                              count: String(featuredShop.productCount),
                            })}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
