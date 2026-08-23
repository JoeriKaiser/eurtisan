import { createFileRoute, Link } from '@tanstack/react-router'
import z from 'zod'
import HomePage from '#/components/HomePage'
import { listCategories } from '#/lib/categories'
import { getFeaturedShops, getMarketplaceStats, listRecentProducts } from '#/lib/products'
import { getSellerShops } from '#/lib/sell-onboarding'
import { createPageMeta } from '#/lib/seo'
import { generateWebSiteJsonLd } from '#/lib/seo-structured-data'
import { hydrateQueryData } from '#/lib/hydrate-query'
import { queryKeys } from '#/lib/query-keys'
import { getCurrentUser } from '#/lib/server-auth'
import { m } from '#/paraglide/messages'

function HomeError({ error }: { error: Error }) {
  const isDev = import.meta.env.DEV

  return (
    <div className='page-wrap px-4 py-20 text-center'>
      <h1 className='display-title mb-4 text-3xl font-semibold text-text-primary'>
        Failed to load marketplace
      </h1>
      <p className='mb-6 text-text-secondary'>{isDev ? error.message : m.error_unexpected()}</p>
      <Link
        to='/'
        className='inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground'
      >
        {m.error_go_home()}
      </Link>
      {isDev && (
        <pre className='mx-auto mt-6 max-w-2xl overflow-auto rounded-xl bg-surface-inset p-4 text-left text-xs text-text-secondary'>
          {error.stack}
        </pre>
      )}
    </div>
  )
}

const homeSearchSchema = z.object({
  accountDeleted: z.union([z.string(), z.number()]).optional(),
})

export const Route = createFileRoute('/')({
  validateSearch: homeSearchSchema,
  loader: async ({ context }) => {
    const [user, categories, products, shops, stats] = await Promise.all([
      getCurrentUser().catch(() => null),
      listCategories({ data: {} }),
      listRecentProducts({ data: { limit: 12 } }),
      getFeaturedShops({ data: { limit: 6 } }),
      getMarketplaceStats(),
    ])
    const sellerShops = user ? await getSellerShops().catch(() => []) : []
    hydrateQueryData(context.queryClient, queryKeys.categoriesList, categories)
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
  const { accountDeleted } = Route.useSearch()
  return (
    <HomePage
      categories={categories}
      products={products}
      shops={shops}
      user={user}
      sellerShops={sellerShops}
      stats={stats}
      accountDeleted={String(accountDeleted) === '1'}
    />
  )
}
