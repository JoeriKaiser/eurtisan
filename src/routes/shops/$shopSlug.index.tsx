import { createFileRoute, notFound } from '@tanstack/react-router'
import z from 'zod'
import { NotFoundPage } from '#/components/NotFoundPage'
import { getShopProductCategories, getShopProducts } from '#/lib/products'
import { createPageMeta } from '#/lib/seo'
import { generateStoreJsonLd } from '#/lib/seo-structured-data'
import { getShopProfile } from '#/lib/shop-profile'
import { m } from '#/paraglide/messages'
import { ShopRouteComponent } from '#/route-components/shops/$shopSlug'
import { ShopError } from '#/route-components/shops/$shopSlug.error'
import { ShopPending } from '#/route-components/shops/$shopSlug.pending'

const shopSearchSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  search: z.string().max(255).optional(),
  // Every browsing filter lives in the URL, so a filtered storefront is
  // linkable and the back button works. Each one catches rather than throws: a
  // hand-edited or truncated URL should degrade to the default view, not to an
  // error page. `inStock` accepts the raw value and is normalised in
  // `loaderDeps` — `z.coerce.boolean()` would read `?inStock=false` as true.
  sort: z.enum(['newest', 'price_asc', 'price_desc']).optional().catch(undefined),
  inStock: z.union([z.string(), z.boolean()]).optional().catch(undefined),
  category: z.string().max(255).optional().catch(undefined),
})

export const Route = createFileRoute('/shops/$shopSlug/')({
  validateSearch: shopSearchSchema,
  loaderDeps: ({ search: { page, search, sort, inStock, category } }) => ({
    page,
    searchQuery: search ?? '',
    sort: sort ?? 'newest',
    inStockOnly: inStock === true || inStock === 'true',
    categorySlug: category?.trim() || undefined,
  }),
  loader: async ({ params, deps }) => {
    try {
      // The profile call is the 404 gate, so it stays ahead of the listing
      // rather than racing it: a rejected sibling in a Promise.all would
      // surface as an unhandled rejection for every unknown shop.
      const shop = await getShopProfile({ data: { slug: params.shopSlug } })

      const [products, categories] = await Promise.all([
        getShopProducts({
          data: {
            shopSlug: params.shopSlug,
            search: deps.searchQuery || undefined,
            categorySlug: deps.categorySlug,
            inStockOnly: deps.inStockOnly || undefined,
            sort: deps.sort,
            page: deps.page,
            pageSize: 12,
          },
        }),
        getShopProductCategories({ data: { shopSlug: params.shopSlug } }),
      ])

      return {
        shop,
        products,
        categories,
        searchQuery: deps.searchQuery,
        sort: deps.sort,
        inStockOnly: deps.inStockOnly,
        categorySlug: deps.categorySlug,
      }
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

    // JSON-LD Store structured data. `shop.rating` is already null below
    // `SHOP_RATING_MIN_REVIEWS`, so the threshold that governs the visible
    // rating governs the emitted `aggregateRating` too — one decision, not two.
    const jsonLd = generateStoreJsonLd({
      shopName: shop.name,
      description: shop.description,
      canonicalPath,
      image: shop.bannerImage ?? shop.image,
      logo: shop.image,
      sameAs: shop.socials.map((social) => social.url),
      addressCountry: shop.origin?.country ?? null,
      aggregateRating: shop.rating
        ? { ratingValue: shop.rating.ratingAverage, reviewCount: shop.rating.reviewCount }
        : null,
    })

    const { meta, links, script } = createPageMeta({
      title,
      description,
      canonicalPath,
      // Banners have a usable social aspect ratio; avatars do not.
      ogImageUrl: shop.bannerImage ?? shop.image ?? undefined,
      jsonLd,
    })

    return { meta, links, script }
  },
  notFoundComponent: NotFoundPage,
  component: ShopRouteComponent,
  errorComponent: ShopError,
  pendingComponent: ShopPending,
})
