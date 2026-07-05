import { Link, useRouter } from '@tanstack/react-router'
import { ArrowRight, Search } from 'lucide-react'
import { useState } from 'react'
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

  return (
    <section className='relative overflow-hidden border-b border-border-subtle bg-bg-base pt-16 pb-24 md:pt-20 md:pb-32'>
      {/* Background atmospheric glows */}
      <div className='pointer-events-none absolute inset-0 select-none'>
        <div className='absolute -left-20 -top-20 size-[360px] rounded-full opacity-35 radial-glow-moss dark:opacity-25' />
        <div className='absolute -bottom-20 -right-20 size-[400px] rounded-full opacity-30 radial-glow-sage dark:opacity-20' />
      </div>

      <div className='max-w-7xl mx-auto px-6 relative z-10 animate-fade-in-up'>
        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-12 lg:gap-8'>
          {/* Left Content Column */}
          <div className='max-w-2xl lg:w-[55%]'>
            <span className='inline-flex items-center gap-1.5 rounded-full bg-accent-primary-subtle px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-accent-primary mb-6'>
              {m.home_hero_kicker()}
            </span>
            <h1 className='display-title mb-6 text-4xl font-bold tracking-tight text-text-primary sm:text-5xl lg:text-6xl xl:text-7xl leading-[1.08]'>
              {m.home_hero_title()}
            </h1>
            <p className='mb-8 max-w-lg font-sans text-base leading-relaxed text-text-secondary sm:text-lg'>
              {m.home_hero_desc()}
            </p>

            {/* Hero Search */}
            <search className='mb-8 max-w-lg block'>
              <form onSubmit={handleSearch}>
                <div className='relative flex gap-2 items-center'>
                  <div className='relative flex-1'>
                    <Search className='absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-placeholder' />
                    <input
                      type='search'
                      placeholder={m.home_search_placeholder()}
                      className={`flex h-12 w-full rounded-full border bg-bg-elevated/85 backdrop-blur-sm px-4 pl-10 text-sm text-text-primary placeholder:text-text-placeholder transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:border-accent-secondary focus-visible:ring-2 focus-visible:ring-accent-secondary/20 disabled:cursor-not-allowed disabled:opacity-50 ${
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
                    className='group relative flex items-center justify-between gap-3 h-12 pl-6 pr-2 bg-accent-primary text-text-on-primary hover:bg-accent-primary-hover active:bg-accent-primary-active rounded-full font-semibold shadow-md active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
                  >
                    <span>{m.home_search_button()}</span>
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
            </search>

            {/* Hero Action Buttons */}
            <div className='flex flex-wrap gap-4 items-center mt-2'>
              <Link
                to={primaryLink}
                search={isPrimaryRedirect ? { redirect: '/sell' } : undefined}
                className='no-underline'
              >
                <button
                  type='button'
                  className='group relative flex items-center justify-between gap-3 h-12 pl-6 pr-2 bg-accent-primary text-text-on-primary hover:bg-accent-primary-hover active:bg-accent-primary-active rounded-full font-semibold shadow-md active:scale-[0.98] transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
                >
                  <span>{primaryText}</span>
                  <span className='flex size-6 rounded-full bg-scrim-subtle group-hover:bg-scrim items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-[1px]'>
                    <ArrowRight size={14} />
                  </span>
                </button>
              </Link>
              <Link to='/search' className='no-underline'>
                <button
                  type='button'
                  className='h-12 px-6 bg-surface-default text-text-primary border border-border-default hover:bg-bg-inset hover:border-border-strong rounded-full font-semibold shadow-sm hover:shadow active:scale-[0.98] transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
                >
                  {m.home_hero_cta_explore()}
                </button>
              </Link>
            </div>
          </div>

          {/* Right Visual Column (Double-Bezel nested architecture) */}
          {shops.length > 0 && (
            <div className='hidden lg:flex items-center justify-center lg:w-[42%]'>
              <Link
                to='/shops/$shopSlug'
                params={{ shopSlug: shops[0].slug }}
                className='block w-full h-full cursor-pointer'
              >
                <div className='relative p-2 rounded-[2.5rem] bg-scrim-subtle border border-border-subtle shadow-xl w-full aspect-[4/3] overflow-hidden group hover:scale-[1.01] hover:shadow-2xl transition-all duration-300'>
                  <div className='relative w-full h-full overflow-hidden rounded-[calc(2.5rem-0.5rem)] bg-bg-elevated shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]'>
                    <img
                      src={shops[0].image ?? '/images/hero_artisan_goods.png'}
                      alt={shops[0].name}
                      className='w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]'
                    />
                    {/* Visual glassmorphic scrim overlay */}
                    <div className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-scrim-image via-scrim-image-subtle to-transparent p-6 flex items-end justify-between pointer-events-none'>
                      <div className='text-white min-w-0'>
                        <p className='text-[9px] uppercase tracking-widest font-bold opacity-80'>
                          {m.home_hero_featured_maker()}
                        </p>
                        <h4 className='font-serif text-base font-bold tracking-wide mt-0.5 truncate'>
                          {shops[0].name}
                        </h4>
                        {shops[0].tagline && (
                          <p className='mt-0.5 text-xs opacity-90 truncate'>{shops[0].tagline}</p>
                        )}
                      </div>
                      <span className='text-[10px] font-bold text-white bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 tracking-wide shrink-0 ml-3'>
                        {shops[0].productCount === 1
                          ? m.home_hero_featured_maker_product_single()
                          : m.home_hero_featured_maker_products({
                              count: String(shops[0].productCount),
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
