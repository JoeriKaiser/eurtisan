import type { listCategories } from '#/lib/categories'
import type { FeaturedShop, RecentProduct } from '#/lib/products'
import { m } from '#/paraglide/messages'
import { HomeHeroSection } from './home/HomeHeroSection'
import { HomeStatsStrip } from './home/HomeStatsStrip'
import { HomeValuePropositionStrip } from './home/HomeValuePropositionStrip'
import { HomeFeaturedProducts } from './home/HomeFeaturedProducts'
import { HomeFeaturedShops } from './home/HomeFeaturedShops'
import { HomeCategoryDiscovery } from './home/HomeCategoryDiscovery'
import { HomePreFooterCTA } from './home/HomePreFooterCTA'

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
    countryCount: number
  }
  accountDeleted?: boolean
}

const DEFAULT_SELLER_SHOPS: NonNullable<HomePageProps['sellerShops']> = []
const DEFAULT_STATS: NonNullable<HomePageProps['stats']> = {
  sellerCount: 0,
  productCount: 0,
  countryCount: 0,
}

export default function HomePage({
  categories,
  products,
  shops,
  user = null,
  sellerShops = DEFAULT_SELLER_SHOPS,
  stats = DEFAULT_STATS,
  accountDeleted = false,
}: HomePageProps) {
  return (
    <div className='bg-bg-base min-h-screen text-text-primary'>
      {accountDeleted && (
        <div
          className='bg-success/10 border-b border-success/20 px-4 py-3 text-center text-sm text-success'
          role='status'
        >
          {m.account_delete_success()}
        </div>
      )}
      {/* Animation Styles */}

      <HomeHeroSection user={user} sellerShops={sellerShops} shops={shops} />
      <HomeStatsStrip stats={stats} />

      <main>
        <div className='mx-auto max-w-7xl px-6 pt-6 pb-16 md:pt-0 md:pb-24'>
          <HomeFeaturedProducts products={products} />
        </div>

        <HomeValuePropositionStrip />

        <div className='mx-auto max-w-7xl space-y-24 px-6 py-16'>
          <HomeFeaturedShops shops={shops} />
          <HomeCategoryDiscovery categories={categories} />
          <HomePreFooterCTA user={user} sellerShops={sellerShops} />
        </div>
      </main>
    </div>
  )
}
