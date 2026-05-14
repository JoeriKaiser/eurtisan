import { createFileRoute } from '@tanstack/react-router'
import HomePage from '#/components/HomePage'
import { listCategories } from '#/lib/categories'
import { getFeaturedShops, listRecentProducts } from '#/lib/products'
import { m } from '#/paraglide/messages'
import { createPageMeta } from '#/lib/seo'

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
    const [categories, products, shops] = await Promise.all([
      listCategories(),
      listRecentProducts({ data: { limit: 12 } }),
      getFeaturedShops({ data: { limit: 6 } }),
    ])
    return { categories, products, shops }
  },
  head: () => {
    const { meta, links } = createPageMeta({
      title: m.meta_title_default(),
      description: m.home_description(),
      canonicalPath: '/',
    })
    return { meta, links }
  },
  component: Home,
  errorComponent: HomeError,
})

function Home() {
  const { categories, products, shops } = Route.useLoaderData()
  return <HomePage categories={categories} products={products} shops={shops} />
}
