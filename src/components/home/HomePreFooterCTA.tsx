import { Link } from '@tanstack/react-router'
import { Button } from '../ui/button'
import { m } from '#/paraglide/messages'

interface HomePreFooterCTAProps {
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

const DEFAULT_SELLER_SHOPS: NonNullable<HomePreFooterCTAProps['sellerShops']> = []

export function HomePreFooterCTA({
  user = null,
  sellerShops = DEFAULT_SELLER_SHOPS,
}: HomePreFooterCTAProps) {
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
    <section
      className='relative overflow-hidden rounded-[2rem] border border-border-default bg-bg-inset px-6 py-14 sm:px-12 sm:py-20 text-center shadow-inner'
      aria-labelledby='pre-footer-heading'
    >
      <div className='pointer-events-none absolute -left-20 -bottom-20 size-64 rounded-full opacity-35 radial-glow-moss-strong dark:opacity-20' />
      <div className='relative max-w-xl mx-auto'>
        <h2
          id='pre-footer-heading'
          className='display-title mb-4 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl'
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
  )
}
