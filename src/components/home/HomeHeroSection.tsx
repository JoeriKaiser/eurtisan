import { Link, useRouter } from '@tanstack/react-router'
import { ArrowRight, Search } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { m } from '#/paraglide/messages'

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
}

const DEFAULT_SELLER_SHOPS: NonNullable<HomeHeroSectionProps['sellerShops']> = []

export function HomeHeroSection({
  user = null,
  sellerShops = DEFAULT_SELLER_SHOPS,
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
    <section className='relative overflow-hidden bg-gradient-to-b from-accent-primary-subtle/20 to-bg-base border-b border-border-subtle/60 pt-20 pb-28 md:pt-32 md:pb-40'>
      <div className='pointer-events-none absolute inset-0'>
        <div className='absolute -left-20 -top-20 size-[360px] rounded-full opacity-35 radial-glow-moss dark:opacity-20' />
        <div className='absolute -bottom-20 -right-20 size-[400px] rounded-full opacity-30 radial-glow-sage dark:opacity-15' />
      </div>

      <div className='max-w-7xl mx-auto px-6 relative z-10 animate-fade-in-up'>
        <div className='max-w-3xl'>
          <p className='island-kicker mb-3 font-sans text-xs font-bold uppercase tracking-wider text-accent-primary'>
            {m.home_hero_kicker()}
          </p>
          <h1 className='display-title mb-6 text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl lg:text-7xl leading-[1.1]'>
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
  )
}
