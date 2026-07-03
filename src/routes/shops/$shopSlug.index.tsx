import { createFileRoute, notFound } from '@tanstack/react-router'
import z from 'zod'
import { NotFoundPage } from '#/components/NotFoundPage'
import { ShopRouteComponent } from '#/route-components/shops/$shopSlug'
import { ShopError } from '#/route-components/shops/$shopSlug.error'
import { ShopPending } from '#/route-components/shops/$shopSlug.pending'
import { getShopBySlug, getShopProducts } from '#/lib/products'
import { createPageMeta } from '#/lib/seo'
import { generateStoreJsonLd } from '#/lib/seo-structured-data'
import { m } from '#/paraglide/messages'

const shopSearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  search: z.string().max(255).optional(),
})

export const Route = createFileRoute('/shops/$shopSlug/')({
  validateSearch: shopSearchSchema,
  loaderDeps: ({ search: { page, search } }) => ({
    page,
    searchQuery: search ?? '',
  }),
  loader: async ({ params, deps }) => {
    try {
      const shop = await getShopBySlug({ data: { slug: params.shopSlug } })

      const products = await getShopProducts({
        data: {
          shopSlug: params.shopSlug,
          search: deps.searchQuery || undefined,
          page: deps.page,
          pageSize: 12,
        },
      })

      return { shop, products, searchQuery: deps.searchQuery }
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
  notFoundComponent: NotFoundPage,
  component: ShopRouteComponent,
  errorComponent: ShopError,
  pendingComponent: ShopPending,
})
