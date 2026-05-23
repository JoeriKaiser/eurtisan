import { Link, useRouter } from '@tanstack/react-router'
import {
  ArrowRight,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Store,
  Eye,
  ArrowUpRight,
} from 'lucide-react'
import { useState } from 'react'
import type { listCategories } from '#/lib/categories'
import type { FeaturedShop, RecentProduct } from '#/lib/products'
import { m } from '#/paraglide/messages'
import CategoryCard from './CategoryCard'
import { getCategoryIcon } from '#/lib/category-icons'
import ProductCard from './ProductCard'
import { Button } from './ui/button'
import { Input } from './ui/input'

export interface HomePageProps {
  categories: Awaited<ReturnType<typeof listCategories>>
  products: RecentProduct[]
  shops: FeaturedShop[]
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
  stats?: {
    sellerCount: number
    productCount: number
  }
}

export default function HomePage({
  categories,
  products,
  shops,
  user = null,
  sellerShops = [],
  stats = { sellerCount: 0, productCount: 0 },
}: HomePageProps) {
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

  // Pre-footer dynamic CTA values
  const preFooterTitle = user ? m.home_pre_footer_title_auth() : m.home_pre_footer_title_guest()
  const preFooterDesc = user ? m.home_pre_footer_desc_auth() : m.home_pre_footer_desc_guest()
  const preFooterCtaText = user ? m.home_pre_footer_cta_auth() : m.home_pre_footer_cta_guest()
  const preFooterCtaLink = user
    ? sellerShops.length > 0
      ? sellerShops[0].status === 'active'
        ? `/creator?shopId=${sellerShops[0].id}`
        : `/sell`
      : `/sell`
    : '/signin'

  return (
    <div className='bg-bg-base min-h-screen text-text-primary'>
      {/* Animation Styles */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-fade-in-up {
            animation: none;
            opacity: 1;
            transform: none;
          }
        }
      `}</style>

      {/* 1. HERO SECTION */}
      <section className='relative overflow-hidden bg-gradient-to-b from-accent-primary-subtle/20 to-bg-base border-b border-border-subtle/60 pt-20 pb-28 md:pt-32 md:pb-40'>
        <div className='pointer-events-none absolute inset-0'>
          <div className='absolute -left-20 -top-20 h-[360px] w-[360px] rounded-full opacity-35 radial-glow-moss dark:opacity-20' />
          <div className='absolute -bottom-20 -right-20 h-[400px] w-[400px] rounded-full opacity-30 radial-glow-sage dark:opacity-15' />
        </div>

        <div className='max-w-7xl mx-auto px-6 relative z-10 animate-fade-in-up'>
          <div className='max-w-3xl'>
            <p className='island-kicker mb-3 font-sans text-xs font-bold uppercase tracking-wider text-accent-primary'>
              {m.home_hero_kicker()}
            </p>
            <h1 className='display-title mb-6 text-4xl font-bold tracking-tight text-text-primary sm:text-5xl lg:text-7xl leading-[1.1]'>
              {m.home_hero_title()}
            </h1>
            <p className='mb-8 max-w-xl font-sans text-base leading-relaxed text-text-secondary sm:text-lg'>
              {m.home_hero_desc()}
            </p>

            {/* Hero Search */}
            <search className='mb-8 max-w-lg block'>
              <form onSubmit={handleSearch}>
                <div className='relative flex gap-2'>
                  <div className='relative flex-1'>
                    <Search className='absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted' />
                    <Input
                      type='search'
                      placeholder={m.home_search_placeholder()}
                      className={`pl-9 bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2 ${
                        searchError ? 'border-error ring-1 ring-error' : ''
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
                  <Button
                    type='submit'
                    variant='primary'
                    className='focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
                  >
                    {m.home_search_button()}
                  </Button>
                </div>
                <div className='min-h-[1.5rem] mt-1.5' aria-live='assertive'>
                  {searchError && (
                    <p id='search-error' className='text-sm text-error font-medium'>
                      {m.home_search_error_empty()}
                    </p>
                  )}
                </div>
              </form>
            </search>

            {/* Hero Action Buttons */}
            <div className='flex flex-wrap gap-4'>
              <Link
                to={primaryLink}
                search={isPrimaryRedirect ? { redirect: '/sell' } : undefined}
                className='no-underline'
              >
                <Button
                  size='lg'
                  className='gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
                >
                  {primaryText}
                  <ArrowRight size={18} />
                </Button>
              </Link>
              <Link to='/search' className='no-underline'>
                <Button
                  size='lg'
                  variant='secondary'
                  className='focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
                >
                  {m.home_hero_cta_explore()}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* STATS STRIP (MOVED HIGHER UP & OVERLAPPING) */}
      <div className='max-w-7xl mx-auto px-6 relative z-20 -mt-16 md:-mt-24 mb-16'>
        <section
          aria-label='Marketplace Statistics'
          className='animate-fade-in-up'
          style={{ animationDelay: '100ms' }}
        >
          <div className='rounded-2xl border border-border-subtle bg-bg-elevated p-8 text-center shadow-lg'>
            <div className='mb-6'>
              <h3 className='text-lg font-bold text-text-primary display-title'>
                {m.home_stats_title()}
              </h3>
              <p className='text-sm text-text-secondary font-sans mt-1'>{m.home_stats_desc()}</p>
            </div>
            <div className='grid gap-6 grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border-subtle'>
              <div className='pt-4 sm:pt-0'>
                <span className='block text-3xl font-extrabold text-accent-primary font-sans tracking-tight'>
                  {stats.sellerCount > 0 ? stats.sellerCount : 120}
                </span>
                <span className='block text-xs font-semibold text-text-secondary uppercase tracking-wider mt-1'>
                  {m.home_stats_makers({
                    count: (stats.sellerCount > 0 ? stats.sellerCount : 120).toString(),
                  })}
                </span>
              </div>
              <div className='pt-4 sm:pt-0'>
                <span className='block text-3xl font-extrabold text-accent-primary font-sans tracking-tight'>
                  {stats.productCount > 0 ? stats.productCount : 1450}
                </span>
                <span className='block text-xs font-semibold text-text-secondary uppercase tracking-wider mt-1'>
                  {m.home_stats_products({
                    count: (stats.productCount > 0 ? stats.productCount : 1450).toString(),
                  })}
                </span>
              </div>
              <div className='pt-4 sm:pt-0'>
                <span className='block text-3xl font-extrabold text-accent-primary font-sans tracking-tight'>
                  27
                </span>
                <span className='block text-xs font-semibold text-text-secondary uppercase tracking-wider mt-1'>
                  {m.home_stats_eu()}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 2. VALUE PROPOSITION STRIP */}
      <section className='border-y border-border-subtle py-8' aria-label='Value Proposition'>
        <div className='max-w-7xl mx-auto px-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4'>
          <div className='flex items-start gap-3'>
            <div className='p-2 rounded-xl bg-accent-primary-subtle text-accent-primary shrink-0'>
              <MapPin size={20} aria-hidden='true' />
            </div>
            <div>
              <h3 className='text-sm font-bold text-text-primary'>
                {m.home_val_made_in_europe_title()}
              </h3>
              <p className='text-xs text-text-secondary mt-0.5 leading-relaxed'>
                {m.home_val_made_in_europe_desc()}
              </p>
            </div>
          </div>
          <div className='flex items-start gap-3'>
            <div className='p-2 rounded-xl bg-accent-primary-subtle text-accent-primary shrink-0'>
              <Store size={20} aria-hidden='true' />
            </div>
            <div>
              <h3 className='text-sm font-bold text-text-primary'>{m.home_val_direct_title()}</h3>
              <p className='text-xs text-text-secondary mt-0.5 leading-relaxed'>
                {m.home_val_direct_desc()}
              </p>
            </div>
          </div>
          <div className='flex items-start gap-3'>
            <div className='p-2 rounded-xl bg-accent-primary-subtle text-accent-primary shrink-0'>
              <ShieldCheck size={20} aria-hidden='true' />
            </div>
            <div>
              <h3 className='text-sm font-bold text-text-primary'>{m.home_val_secure_title()}</h3>
              <p className='text-xs text-text-secondary mt-0.5 leading-relaxed'>
                {m.home_val_secure_desc()}
              </p>
            </div>
          </div>
          <div className='flex items-start gap-3'>
            <div className='p-2 rounded-xl bg-accent-primary-subtle text-accent-primary shrink-0'>
              <Eye size={20} aria-hidden='true' />
            </div>
            <div>
              <h3 className='text-sm font-bold text-text-primary'>{m.home_val_gdpr_title()}</h3>
              <p className='text-xs text-text-secondary mt-0.5 leading-relaxed'>
                {m.home_val_gdpr_desc()}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN CONTAINER */}
      <main className='max-w-7xl mx-auto px-6 py-16 space-y-24'>
        {/* 3. FEATURED PRODUCTS SECTION */}
        <section aria-labelledby='products-heading'>
          <div className='mb-8 flex items-end justify-between gap-4'>
            <div>
              <h2
                id='products-heading'
                className='display-title text-2xl font-bold tracking-tight text-text-primary sm:text-3xl'
              >
                {m.home_products_title()}
              </h2>
              <p className='mt-1 text-sm text-text-secondary font-sans'>
                {m.home_products_subtitle()}
              </p>
            </div>
            <Link
              to='/search'
              className='group text-sm font-bold text-accent-primary hover:text-accent-primary-hover no-underline inline-flex items-center gap-1 transition-colors'
            >
              View all products
              <ArrowRight size={16} className='transition-transform group-hover:translate-x-0.5' />
            </Link>
          </div>

          {products.length === 0 ? (
            <div className='island-shell rounded-2xl p-8 text-center sm:p-12'>
              <Package size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
              <h3 className='mb-2 text-lg font-semibold text-text-primary display-title'>
                {m.home_products_empty_title()}
              </h3>
              <p className='mb-6 text-text-secondary font-sans text-sm max-w-md mx-auto'>
                {m.home_products_empty_desc()}
              </p>
              <Link
                to='/category/all'
                className='inline-flex items-center gap-2 rounded-lg bg-accent-primary px-6 py-3 text-sm font-semibold text-text-on-primary no-underline transition-colors hover:bg-accent-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
              >
                {m.home_products_empty_cta()}
              </Link>
            </div>
          ) : (
            <div className='grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'>
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  imageUrl={product.image?.url ?? null}
                />
              ))}
            </div>
          )}
        </section>

        {/* 4. FEATURED SHOPS SECTION */}
        {shops.length === 0 ? (
          <section
            className='island-shell rounded-2xl p-8 text-center sm:p-12'
            aria-labelledby='shops-empty-heading'
          >
            <Store size={48} className='mx-auto mb-4 text-text-muted' aria-hidden='true' />
            <h3
              id='shops-empty-heading'
              className='mb-2 text-lg font-semibold text-text-primary display-title'
            >
              {m.home_shops_empty_title()}
            </h3>
            <p className='mb-6 text-text-secondary font-sans text-sm max-w-md mx-auto'>
              {m.home_shops_empty_desc()}
            </p>
            <Link
              to='/sell'
              className='inline-flex items-center gap-2 rounded-lg bg-accent-primary px-6 py-3 text-sm font-semibold text-text-on-primary no-underline transition-colors hover:bg-accent-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
            >
              {m.home_open_shop()}
            </Link>
          </section>
        ) : (
          <section aria-labelledby='shops-heading'>
            <div className='mb-8 flex items-end justify-between gap-4'>
              <div>
                <h2
                  id='shops-heading'
                  className='display-title text-2xl font-bold tracking-tight text-text-primary sm:text-3xl'
                >
                  {m.home_shops_title()}
                </h2>
                <p className='mt-1 text-sm text-text-secondary font-sans'>
                  {m.home_shops_subtitle()}
                </p>
              </div>
            </div>
            <div className='grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'>
              {shops.map((shop) => (
                <Link
                  key={shop.id}
                  to='/shops/$shopSlug'
                  params={{ shopSlug: shop.slug }}
                  className='island-shell group flex items-start gap-4 rounded-2xl p-5 no-underline transition-all duration-fast ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
                >
                  <div className='flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent-primary-subtle text-accent-primary transition-colors duration-fast group-hover:bg-accent-primary group-hover:text-text-on-primary overflow-hidden'>
                    {shop.image ? (
                      <img src={shop.image} alt='' className='h-full w-full object-cover' />
                    ) : (
                      <Store size={24} strokeWidth={1.5} />
                    )}
                  </div>
                  <div className='min-w-0 flex-1'>
                    {shop.category && (
                      <span className='inline-block mb-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-primary'>
                        {shop.category}
                      </span>
                    )}
                    <h3 className='text-sm font-bold text-text-primary truncate font-sans group-hover:text-accent-primary transition-colors'>
                      Shop {shop.name.startsWith('Shop ') ? shop.name.substring(5) : shop.name}
                    </h3>
                    {shop.tagline && (
                      <p className='text-xs text-text-secondary truncate mt-0.5 font-sans italic'>
                        "{shop.tagline}"
                      </p>
                    )}
                    <p className='text-xs text-text-muted font-sans mt-1.5 font-medium'>
                      {shop.productCount} {shop.productCount === 1 ? 'product' : 'products'}
                    </p>
                  </div>
                  <ArrowUpRight
                    size={16}
                    className='text-text-muted transition-colors transition-transform duration-fast group-hover:translate-x-0.5 group-hover:translate-y--0.5 group-hover:text-accent-primary self-start mt-1 shrink-0'
                  />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 5. CATEGORY DISCOVERY GRID */}
        {categories.length > 0 && (
          <section aria-labelledby='categories-heading'>
            <div className='mb-8 flex items-end justify-between gap-4'>
              <div>
                <h2
                  id='categories-heading'
                  className='display-title text-2xl font-bold tracking-tight text-text-primary sm:text-3xl'
                >
                  {m.home_categories_title()}
                </h2>
                <p className='mt-1 text-sm text-text-secondary font-sans'>
                  {m.home_categories_subtitle()}
                </p>
              </div>
            </div>

            {(() => {
              const [firstCategory, ...otherCategories] = categories
              return (
                <div className='space-y-4'>
                  {/* Spotlight Category */}
                  {firstCategory && (
                    <Link
                      to='/category/$slug'
                      params={{ slug: firstCategory.slug }}
                      className='group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border-default bg-surface-default p-6 sm:p-8 shadow-sm transition-all duration-fast ease-out hover:-translate-y-0.5 hover:border-accent-primary hover:shadow-md hover:ring-2 hover:ring-accent-primary/20 no-underline min-h-[180px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
                    >
                      <div className='pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-20 radial-glow-moss' />

                      <div className='flex items-start justify-between gap-4 relative z-10'>
                        <div className='flex size-14 items-center justify-center rounded-xl bg-accent-primary-subtle text-accent-primary transition-colors duration-fast group-hover:bg-accent-primary group-hover:text-text-on-primary'>
                          {(() => {
                            const Icon = getCategoryIcon(firstCategory.name)
                            return <Icon size={28} strokeWidth={1.5} />
                          })()}
                        </div>
                        <span className='inline-flex items-center gap-1 rounded-full bg-accent-primary-subtle px-2.5 py-0.5 text-[10px] font-semibold text-accent-primary uppercase tracking-wider'>
                          Spotlight
                        </span>
                      </div>
                      <div className='mt-6 relative z-10'>
                        <h3 className='display-title text-xl sm:text-2xl font-bold text-text-primary mb-1'>
                          {firstCategory.name}
                        </h3>
                        <p className='text-xs sm:text-sm text-text-secondary max-w-md font-sans'>
                          {firstCategory.description || m.home_categories_subtitle()}
                        </p>
                      </div>
                    </Link>
                  )}

                  {/* Remaining Categories Grid */}
                  {otherCategories.length > 0 && (
                    <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                      {otherCategories.slice(0, 6).map((category) => (
                        <CategoryCard
                          key={category.id}
                          id={category.id}
                          name={category.name}
                          slug={category.slug}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
          </section>
        )}

        {/* TODO: Refactor with real reviews from the database later. Placeholder testimonials and trust badges have been commented out to reduce redundancy. */}
        {/* 
        <section className='space-y-12' aria-label='Trust and Reviews'>
          <div className='grid gap-8 grid-cols-1 md:grid-cols-2'>
            <div className='island-shell rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6 bg-bg-elevated relative overflow-hidden'>
              <div
                className='absolute right-4 top-4 text-accent-primary-subtle opacity-50'
                aria-hidden='true'
              >
                <svg width='40' height='32' viewBox='0 0 40 32' fill='currentColor' role='img'>
                  <title>Quote icon</title>
                  <path d='M11.6667 0C18.1111 0 23.3333 5.33333 23.3333 12C23.3333 21.7778 14.8889 29.7778 3.33333 32L0 28.4444C6.88889 25.3333 10 20.4444 10.2222 15.1111C5.11111 14.8889 0.888889 10.6667 0.888889 5.33333C0.888889 2.44444 2.88889 0 11.6667 0ZM28.3333 0C34.7778 0 40 5.33333 40 12C40 21.7778 31.5556 29.7778 20 32L16.6667 28.4444C23.5556 25.3333 26.6667 20.4444 26.8889 15.1111C21.7778 14.8889 17.5556 10.6667 17.5556 5.33333C17.5556 2.44444 19.5556 0 28.3333 0Z' />
                </svg>
              </div>
              <blockquote className='m-0 text-text-primary text-base sm:text-lg font-medium leading-relaxed italic z-10'>
                "{m.home_testimonial_1_quote()}"
              </blockquote>
              <div className='flex items-center gap-3'>
                <div className='flex size-10 items-center justify-center rounded-full bg-accent-primary text-text-on-primary font-bold text-sm'>
                  C
                </div>
                <div>
                  <cite className='not-italic font-bold text-sm text-text-primary block'>
                    {m.home_testimonial_1_author()}
                  </cite>
                  <div
                    className='flex text-amber-500 gap-0.5 mt-0.5'
                    role='img'
                    aria-label='5 star rating'
                  >
                    {[1, 2, 3, 4, 5].map((num) => (
                      <Star key={num} size={12} fill='currentColor' />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className='island-shell rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6 bg-bg-elevated relative overflow-hidden'>
              <div
                className='absolute right-4 top-4 text-accent-primary-subtle opacity-50'
                aria-hidden='true'
              >
                <svg width='40' height='32' viewBox='0 0 40 32' fill='currentColor' role='img'>
                  <title>Quote icon</title>
                  <path d='M11.6667 0C18.1111 0 23.3333 5.33333 23.3333 12C23.3333 21.7778 14.8889 29.7778 3.33333 32L0 28.4444C6.88889 25.3333 10 20.4444 10.2222 15.1111C5.11111 14.8889 0.888889 10.6667 0.888889 5.33333C0.888889 2.44444 2.88889 0 11.6667 0ZM28.3333 0C34.7778 0 40 5.33333 40 12C40 21.7778 31.5556 29.7778 20 32L16.6667 28.4444C23.5556 25.3333 26.6667 20.4444 26.8889 15.1111C21.7778 14.8889 17.5556 10.6667 17.5556 5.33333C17.5556 2.44444 19.5556 0 28.3333 0Z' />
                </svg>
              </div>
              <blockquote className='m-0 text-text-primary text-base sm:text-lg font-medium leading-relaxed italic z-10'>
                "{m.home_testimonial_2_quote()}"
              </blockquote>
              <div className='flex items-center gap-3'>
                <div className='flex size-10 items-center justify-center rounded-full bg-accent-secondary text-text-on-primary font-bold text-sm'>
                  M
                </div>
                <div>
                  <cite className='not-italic font-bold text-sm text-text-primary block'>
                    {m.home_testimonial_2_author()}
                  </cite>
                  <div
                    className='flex text-amber-500 gap-0.5 mt-0.5'
                    role='img'
                    aria-label='5 star rating'
                  >
                    {[1, 2, 3, 4, 5].map((num) => (
                      <Star key={num} size={12} fill='currentColor' />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className='flex flex-wrap justify-center items-center gap-6 md:gap-12 py-4 border-t border-b border-border-subtle text-text-muted text-xs font-semibold tracking-wider uppercase'>
            <div className='flex items-center gap-2'>
              <CheckCircle size={16} className='text-accent-primary' aria-hidden='true' />
              <span>GDPR Compliant</span>
            </div>
            <div className='flex items-center gap-2'>
              <CheckCircle size={16} className='text-accent-primary' aria-hidden='true' />
              <span>Secure Checkout via Mollie</span>
            </div>
            <div className='flex items-center gap-2'>
              <CheckCircle size={16} className='text-accent-primary' aria-hidden='true' />
              <span>100% EU Artisan Network</span>
            </div>
          </div>
        </section>
        */}

        {/* 7. PRE-FOOTER CTA BANNER */}
        <section
          className='relative overflow-hidden rounded-[2rem] border border-border-default bg-bg-inset px-6 py-14 sm:px-12 sm:py-20 text-center shadow-inner'
          aria-labelledby='pre-footer-heading'
        >
          <div className='pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full opacity-35 radial-glow-moss-strong dark:opacity-20' />
          <div className='relative max-w-xl mx-auto'>
            <h2
              id='pre-footer-heading'
              className='display-title mb-4 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl'
            >
              {preFooterTitle}
            </h2>
            <p className='mb-8 text-base leading-relaxed text-text-secondary sm:text-lg font-sans'>
              {preFooterDesc}
            </p>
            <Link to={preFooterCtaLink} className='no-underline'>
              <Button
                size='lg'
                className='focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
              >
                {preFooterCtaText}
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
