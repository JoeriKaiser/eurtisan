import type { listCategories } from '#/lib/categories'
import type { FeaturedShop, RecentProduct } from '#/lib/products'
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
}: HomePageProps) {
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

      <HomeHeroSection user={user} sellerShops={sellerShops} />
      <HomeStatsStrip stats={stats} />
      <HomeValuePropositionStrip />

      {/* MAIN CONTAINER */}
      <main className='max-w-7xl mx-auto px-6 py-16 space-y-24'>
        <HomeFeaturedProducts products={products} />
        <HomeFeaturedShops shops={shops} />
        <HomeCategoryDiscovery categories={categories} />
        <HomePreFooterCTA user={user} sellerShops={sellerShops} />
      </main>
    </div>
  )
}
