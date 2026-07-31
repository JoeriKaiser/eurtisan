import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import z from 'zod'
import { createIpRateLimitMiddleware } from './rate-limit'

export type {
  FeaturedShop,
  PaginatedProducts,
  PublicProduct,
  RecentProduct,
  ShopProductCategory,
  ShopSummary,
  SortOption,
} from './products.server'

export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  slug: z.string().min(1).max(255),
  price: z.string().min(1).max(50),
  categoryId: z.string().uuid().optional(),
})

export const listProductsByCategorySlug = createServerFn({
  method: 'GET',
})
  .inputValidator(
    z.object({
      slug: z.string().min(1),
      page: z.coerce.number().int().min(1).optional().default(1),
      pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
      sort: z.enum(['newest', 'price_asc', 'price_desc']).optional(),
      inStockOnly: z.boolean().optional(),
      minPriceCents: z.coerce.number().int().min(0).optional(),
      maxPriceCents: z.coerce.number().int().min(0).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { listProductsByCategorySlugQuery } = await import('./products.server')
    return listProductsByCategorySlugQuery(
      data.slug,
      { page: data.page, pageSize: data.pageSize },
      {
        sort: data.sort,
        inStockOnly: data.inStockOnly,
        minPriceCents: data.minPriceCents,
        maxPriceCents: data.maxPriceCents,
      },
    )
  })

export const listRecentProducts = createServerFn({
  method: 'GET',
})
  .inputValidator(z.object({ limit: z.number().min(1).max(24).optional() }))
  .handler(async ({ data }) => {
    const { listRecentProductsQuery } = await import('./products.server')
    return listRecentProductsQuery(data.limit ?? 8)
  })

export const getFeaturedShops = createServerFn({
  method: 'GET',
})
  .inputValidator(z.object({ limit: z.number().min(1).max(24) }))
  .handler(async ({ data }) => {
    const { getFeaturedShopsQuery } = await import('./products.server')
    return getFeaturedShopsQuery(data.limit)
  })

export const getMarketplaceStats = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { getMarketplaceStatsQuery } = await import('./products.server')
  return getMarketplaceStatsQuery()
})

const getProductBySlugSchema = z.object({
  shopSlug: z.string().min(1),
  productSlug: z.string().min(1),
})

export const getProductBySlug = createServerFn({
  method: 'GET',
})
  .inputValidator(getProductBySlugSchema)
  .handler(async ({ data }) => {
    const { getProductBySlugQuery, getMoreFromShopQuery } = await import('./products.server')
    const result = await getProductBySlugQuery(data.shopSlug, data.productSlug)

    if (!result) {
      throw notFound()
    }

    // Fetched with the product rather than on the client: the rail is above the
    // fold on a conversion page, and a second round trip would render it late.
    const moreFromShop = await getMoreFromShopQuery(data.shopSlug, result.id)

    return { ...result, moreFromShop }
  })

const getShopBySlugSchema = z.object({
  slug: z.string().min(1),
})

export const getShopBySlug = createServerFn({
  method: 'GET',
})
  .inputValidator(getShopBySlugSchema)
  .handler(async ({ data }) => {
    const { getShopBySlugQuery } = await import('./products.server')
    const result = await getShopBySlugQuery(data.slug)

    if (!result) {
      throw notFound()
    }

    return result
  })

const getShopProductsSchema = z.object({
  shopSlug: z.string().min(1),
  search: z.string().min(1).max(255).optional(),
  categorySlug: z.string().min(1).max(255).optional(),
  inStockOnly: z.boolean().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).optional().default('newest'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const getShopProducts = createServerFn({
  method: 'GET',
})
  .inputValidator(getShopProductsSchema)
  .handler(async ({ data }) => {
    const { getShopProductsQuery } = await import('./products.server')
    return getShopProductsQuery(data.shopSlug, {
      search: data.search,
      categorySlug: data.categorySlug,
      inStockOnly: data.inStockOnly,
      sort: data.sort,
      pagination: { page: data.page, pageSize: data.pageSize },
    })
  })

export const getShopProductCategories = createServerFn({
  method: 'GET',
})
  .inputValidator(z.object({ shopSlug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { getShopProductCategoriesQuery } = await import('./products.server')
    return getShopProductCategoriesQuery(data.shopSlug)
  })

const searchProductsSchema = z.object({
  query: z.string().max(255).optional(),
  categorySlug: z.string().min(1).optional(),
  shopSlug: z.string().min(1).optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  inStockOnly: z.coerce.boolean().optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest']).optional().default('relevance'),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(24),
})

export const listShops = createServerFn({
  method: 'GET',
})
  .inputValidator(
    z.object({
      page: z.coerce.number().int().min(1).optional().default(1),
      pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
    }),
  )
  .handler(async ({ data }) => {
    const { listShopsQuery } = await import('./products.server')
    const limit = Math.min(100, Math.max(1, data.pageSize))
    const offset = (Math.max(1, data.page) - 1) * limit
    return listShopsQuery(limit, offset)
  })

const searchRateLimitMiddleware = createIpRateLimitMiddleware(30, 60_000, 'search')

export const searchProducts = createServerFn({
  method: 'GET',
})
  .middleware([searchRateLimitMiddleware])
  .inputValidator(searchProductsSchema)
  .handler(async ({ data }) => {
    const { searchProductsQuery } = await import('./products.server')
    return searchProductsQuery(
      data.query,
      {
        categorySlug: data.categorySlug,
        shopSlug: data.shopSlug,
        minPriceCents: data.minPriceCents,
        maxPriceCents: data.maxPriceCents,
        inStockOnly: data.inStockOnly,
      },
      data.sort,
      { page: data.page, pageSize: data.pageSize },
    )
  })

const searchSuggestionsFallbackSchema = z.object({
  query: z.string().min(1).max(255),
})

export const searchSuggestionsFallback = createServerFn({
  method: 'GET',
})
  .middleware([searchRateLimitMiddleware])
  .inputValidator(searchSuggestionsFallbackSchema)
  .handler(async ({ data }) => {
    const { searchSuggestionsFallbackQuery } = await import('./products.server')
    return searchSuggestionsFallbackQuery(data.query)
  })

/**
 * Queries other buyers actually ran, for the overlay's trending list.
 *
 * Returns an empty list before any telemetry exists; the caller falls back to a
 * curated set so a cold install still shows something useful.
 */
export const listTrendingSearches = createServerFn({
  method: 'GET',
})
  .middleware([searchRateLimitMiddleware])
  .handler(async () => {
    const { getPopularQueries } = await import('./search/analytics.server')
    try {
      return await getPopularQueries(30, 6)
    } catch {
      return [] as string[]
    }
  })

const trackSearchClickSchema = z.object({
  query: z.string().min(1).max(255),
  productId: z.string().min(1).max(255),
  position: z.coerce.number().int().min(1).max(1000),
})

/**
 * Record that a buyer opened a search result.
 *
 * Fire-and-forget from the client: the response carries no data and a failure
 * here must never interrupt navigation to the product.
 */
export const trackSearchClick = createServerFn({
  method: 'POST',
})
  .middleware([searchRateLimitMiddleware])
  .inputValidator(trackSearchClickSchema)
  .handler(async ({ data }) => {
    const { recordSearchClick } = await import('./search/analytics.server')
    const { searchResultClicksTotal } = await import('./metrics.server')
    searchResultClicksTotal.inc()
    await recordSearchClick({
      query: data.query,
      productId: data.productId,
      position: data.position,
    })
    return { ok: true as const }
  })
