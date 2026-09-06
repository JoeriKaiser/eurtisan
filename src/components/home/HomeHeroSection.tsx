import { Link, useRouter } from '@tanstack/react-router'
import { ArrowRight, Search } from 'lucide-react'
import { useState } from 'react'
import {
  getHomeHeroLcpSrcSet,
  getHomeHeroLcpUrl,
  HOME_HERO_FALLBACK_IMAGE,
  HOME_HERO_LCP_SIZES,
} from '#/lib/images/home-hero'
import { m } from '#/paraglide/messages'

function HomeHeroLcpImage({
  src,
  srcSet,
  alt,
  className,
}: {
  src: string
  srcSet?: string
  alt: string
  className: string
}) {
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? HOME_HERO_LCP_SIZES : undefined}
      alt={alt}
      width={960}
      height={720}
      fetchPriority='high'
      loading='eager'
      decoding='sync'
      className={className}
      onError={(event) => {
        const image = event.currentTarget
        if (image.src.includes(HOME_HERO_FALLBACK_IMAGE)) {
          return
        }
        image.removeAttribute('srcset')
        image.removeAttribute('sizes')
        image.src = HOME_HERO_FALLBACK_IMAGE
      }}
    />
  )
}

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
  const featuredImageSrc = getHomeHeroLcpUrl(featuredShop?.image)
  const featuredImageSrcSet = getHomeHeroLcpSrcSet(featuredShop?.image)
  const featuredImageAlt = featuredShop ? featuredShop.name : m.home_hero_image_alt()
  return (
    <section className='border-b border-border-subtle bg-bg-base py-10 sm:py-14 lg:py-20'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='flex flex-col lg:flex-row-reverse lg:items-center lg:justify-between lg:gap-12'>
          <div className='mb-8 lg:mb-0 lg:w-[42%]'>
            {featuredShop ? (
              <div className='overflow-hidden rounded-xl border border-border-subtle shadow-xs lg:rounded-2xl lg:bg-surface-default lg:p-4 lg:shadow-sm'>
                <Link
                  to='/shops/$shopSlug'
                  params={{ shopSlug: featuredShop.slug }}
                  className='relative block overflow-hidden no-underline lg:rounded-xl'
                >
                  <HomeHeroLcpImage
                    src={featuredImageSrc}
                    srcSet={featuredImageSrcSet}
                    alt={featuredImageAlt}
                    className='aspect-video w-full object-cover sm:aspect-[5/4] lg:aspect-[4/3] lg:transition-transform lg:duration-500 lg:ease-out lg:hover:scale-[1.02]'
                  />
                  <div className='absolute bottom-3 left-3 hidden rounded-lg bg-bg-base/90 px-3 py-1.5 text-xs font-semibold text-text-primary shadow-xs backdrop-blur-sm lg:block'>
                    {m.home_hero_featured_maker()}
                  </div>
                </Link>
                <div className='mt-4 hidden lg:block'>
                  <div className='flex items-baseline justify-between'>
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
                    <p className='mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary'>
                      {featuredShop.tagline}
                    </p>
                  )}
                  <div className='mt-4 flex items-center justify-between border-t border-border-subtle pt-3'>
                    <span className='text-xs text-text-muted'>{m.home_trust_direct()}</span>
                    <Link
                      to='/shops/$shopSlug'
                      params={{ shopSlug: featuredShop.slug }}
                      className='inline-flex items-center gap-1 text-xs font-semibold text-accent-primary hover:underline'
                    >
                      <span>{m.product_visit_shop()}</span>
                      <span aria-hidden='true'>&rarr;</span>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className='overflow-hidden rounded-xl border border-border-subtle shadow-xs'>
                <HomeHeroLcpImage
                  src={featuredImageSrc}
                  srcSet={featuredImageSrcSet}
                  alt={featuredImageAlt}
                  className='aspect-video w-full object-cover sm:aspect-[5/4]'
                />
              </div>
            )}
          </div>

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
        </div>
      </div>
    </section>
  )
}
