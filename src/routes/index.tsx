import { createFileRoute } from '@tanstack/react-router'
import HomePage from '#/components/HomePage'
import { listCategories } from '#/lib/categories'
import { getFeaturedShops, listRecentProducts, getMarketplaceStats } from '#/lib/products'
import { createPageMeta } from '#/lib/seo'
import { generateWebSiteJsonLd } from '#/lib/seo-structured-data'
import { m } from '#/paraglide/messages'
import { getCurrentUser } from '#/lib/server-auth'
import { getSellerShops } from '#/lib/sell-onboarding'

function HomeError({ error }: { error: Error }) {
  return (
    <div className='page-wrap px-4 py-20 text-center'>
      <h1 className='display-title mb-4 text-3xl font-bold text-text-primary'>
        Failed to load marketplace
      </h1>
      <p className='mb-6 text-text-secondary'>{error.message}</p>
      <pre className='mx-auto max-w-2xl overflow-auto rounded-xl bg-surface-inset p-4 text-left text-xs text-text-secondary'>
        {error.stack}
      </pre>
    </div>
  )
}

export const Route = createFileRoute('/')({
  loader: async () => {
    const user = await getCurrentUser().catch(() => null)
    const [categories, products, shops, sellerShops, stats] = await Promise.all([
      listCategories(),
      listRecentProducts({ data: { limit: 12 } }),
      getFeaturedShops({ data: { limit: 6 } }),
      user ? getSellerShops().catch(() => []) : Promise.resolve([]),
      getMarketplaceStats(),
    ])
    return { categories, products, shops, user, sellerShops, stats }
  },
  head: () => {
    // JSON-LD WebSite structured data
    const jsonLd = generateWebSiteJsonLd()

    const { meta, links, script } = createPageMeta({
      title: m.home_meta_title(),
      description: m.home_meta_description(),
      canonicalPath: '/',
      jsonLd,
    })
    return { meta, links, script }
  },
  component: Home,
  errorComponent: HomeError,
})

function Home() {
  const { categories, products, shops, user, sellerShops, stats } = Route.useLoaderData()
  return (
    <HomePage
      categories={categories}
      products={products}
      shops={shops}
      user={user}
      sellerShops={sellerShops}
      stats={stats}
    />
  )
}
