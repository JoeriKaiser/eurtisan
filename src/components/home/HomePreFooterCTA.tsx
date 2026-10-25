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
  let preFooterCtaLink = '/signin'
  if (user) {
    if (sellerShops.length > 0) {
      const activeShop = sellerShops.find((s) => s.status === 'active' || s.status === 'paused')
      const draftShop = sellerShops.find(
        (s) => s.status === 'draft' || s.status === 'changes_requested',
      )
      const pendingShop = sellerShops.find(
        (s) => s.status === 'pending_review' || s.status === 'approved' || s.status === 'rejected',
      )

      if (activeShop) {
        preFooterCtaLink = `/studio/${activeShop.id}`
      } else if (draftShop) {
        preFooterCtaLink = `/sell/onboarding/${draftShop.id}`
      } else if (pendingShop) {
        preFooterCtaLink = `/sell/status/${pendingShop.id}`
      } else {
        preFooterCtaLink = `/studio/${sellerShops[0].id}`
      }
    } else {
      preFooterCtaLink = '/sell'
    }
  }

  return (
    <section
      className='rounded-3xl border border-border-subtle bg-surface-default p-10 sm:p-16 text-center shadow-xs'
      aria-labelledby='pre-footer-heading'
    >
      <div className='max-w-xl mx-auto flex flex-col items-center'>
        <h2
          id='pre-footer-heading'
          className='display-title mb-4 text-3xl sm:text-4xl font-bold tracking-tight text-text-primary leading-tight'
        >
          {preFooterTitle}
        </h2>
        <p className='mb-8 text-sm sm:text-base leading-relaxed text-text-secondary max-w-md font-sans'>
          {preFooterDesc}
        </p>
        <Link
          to={preFooterCtaLink}
          className='inline-flex items-center gap-2 rounded-xl bg-accent-primary px-8 py-3.5 text-sm font-semibold text-text-on-primary hover:bg-accent-primary-hover active:bg-accent-primary-active transition-colors no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2'
        >
          <span>{preFooterCtaText}</span>
          <ArrowRight size={16} aria-hidden='true' />
        </Link>
      </div>
    </section>
  )
}
