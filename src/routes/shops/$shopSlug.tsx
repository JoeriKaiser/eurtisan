import { createFileRoute, notFound } from '@tanstack/react-router'
import ShopPage from '#/components/ShopPage'
import { getShopBySlug, getShopProducts } from '#/lib/products'
import { createPageMeta } from '#/lib/seo'
import { generateStoreJsonLd } from '#/lib/seo-structured-data'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/shops/$shopSlug')({
  loader: async ({ params, search }) => {
    try {
      const shop = await getShopBySlug({ data: { slug: params.shopSlug } })

      const page = typeof search.page === 'string' ? Number.parseInt(search.page, 10) || 1 : 1
      const searchQuery = typeof search.search === 'string' ? search.search : ''

      const products = await getShopProducts({
        data: {
          shopSlug: params.shopSlug,
          search: searchQuery || undefined,
          page,
          pageSize: 12,
        },
      })

      return { shop, products, searchQuery }
    } catch (err) {
      if (err instanceof Response && err.status === 404) {
        throw notFound()
      }
      throw err
    }
  },
  head: ({ loaderData }) => {
    const shop = loaderData?.shop
    if (!shop) {
      const { meta, links } = createPageMeta({
        title: m.meta_title_default(),
        description: m.meta_default_description(),
        canonicalPath: '/',
      })
      return { meta, links }
    }

    const title = `${shop.name} | Eurtisan`
    const description = shop.description ?? m.meta_default_description()
    const canonicalPath = `/shops/${shop.slug}`

    // JSON-LD Store structured data
    const jsonLd = generateStoreJsonLd({
      shopName: shop.name,
      description: shop.description,
      canonicalPath,
      image: shop.image,
    })

    const { meta, links, script } = createPageMeta({
      title,
      description,
      canonicalPath,
      ogImageUrl: shop.image ?? undefined,
      jsonLd,
    })

    return { meta, links, script }
  },
  component: ShopRouteComponent,
  errorComponent: ShopError,
  pendingComponent: ShopPending,
})

function ShopRouteComponent() {
  const { shop, products, searchQuery } = Route.useLoaderData()
  return <ShopPage shop={shop} products={products} searchQuery={searchQuery} />
}

function ShopError({ error }: { error: Error }) {
  return (
    <main className='page-wrap px-4 py-20 text-center'>
      <h1 className='display-title mb-4 text-3xl font-bold text-text-primary'>
        {m.error_unexpected()}
      </h1>
      <p className='mb-6 text-text-secondary'>{error.message}</p>
    </main>
  )
}

function ShopPending() {
  return (
    <main className='page-wrap px-4 pb-16 pt-14'>
      <div className='island-shell rounded-2xl px-6 py-10 sm:px-10 sm:py-14'>
        <div className='mb-4 h-4 w-20 animate-pulse rounded bg-[var(--sand)]' />
        <div className='mb-4 h-10 w-2/3 animate-pulse rounded bg-[var(--sand)]' />
        <div className='h-4 w-1/2 animate-pulse rounded bg-[var(--sand)]' />
      </div>
      <div className='mt-8'>
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3' role='status' aria-live='polite'>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={`skeleton-${n}`}
              className='island-shell flex flex-col overflow-hidden rounded-2xl'
            >
              <div className='aspect-[4/3] w-full animate-pulse bg-[var(--sand)]' />
              <div className='flex flex-1 flex-col gap-2 p-4'>
                <div className='h-5 w-2/3 animate-pulse rounded bg-[var(--sand)]' />
                <div className='h-4 w-full animate-pulse rounded bg-[var(--sand)]' />
                <div className='mt-auto h-6 w-1/3 animate-pulse rounded bg-[var(--sand)]' />
              </div>
            </div>
          ))}
          <span className='sr-only'>{m.product_grid_loading()}</span>
        </div>
      </div>
    </main>
  )
}
