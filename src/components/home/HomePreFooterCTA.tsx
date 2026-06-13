import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
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
      className='p-2 rounded-[3rem] bg-black/5 dark:bg-white/5 border border-border-subtle shadow-xl w-full relative overflow-hidden animate-fade-in-up'
      aria-labelledby='pre-footer-heading'
    >
      {/* Inner core */}
      <div className='bg-bg-inset rounded-[calc(3rem-0.5rem)] px-6 py-16 sm:px-12 sm:py-24 text-center relative overflow-hidden shadow-inner'>
        {/* Layered radial glow blobs */}
        <div className='pointer-events-none absolute -left-20 -bottom-20 size-[320px] rounded-full opacity-40 radial-glow-moss-strong dark:opacity-25' />
        <div className='pointer-events-none absolute -right-20 -top-20 size-[320px] rounded-full opacity-30 radial-glow-sage dark:opacity-20' />

        <div className='relative max-w-xl mx-auto flex flex-col items-center'>
          <h2
            id='pre-footer-heading'
            className='display-title mb-6 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl leading-[1.15]'
          >
            {preFooterTitle}
          </h2>
          <p className='mb-8 text-base leading-relaxed text-text-secondary sm:text-lg font-sans max-w-md'>
            {preFooterDesc}
          </p>
          <Link to={preFooterCtaLink} className='no-underline'>
            <button
              type='button'
              className='group relative flex items-center justify-between gap-3 h-12 pl-6 pr-2 bg-accent-primary text-text-on-primary hover:bg-accent-primary-hover active:bg-accent-primary-active rounded-full font-semibold shadow-md active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
            >
              <span>{preFooterCtaText}</span>
              <span className='flex size-6 rounded-full bg-black/10 dark:bg-white/10 items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-[1px]'>
                <ArrowRight size={14} />
              </span>
            </button>
          </Link>
        </div>
      </div>
    </section>
  )
}
