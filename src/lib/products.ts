import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import z from 'zod'
import { createIpRateLimitMiddleware } from './rate-limit'

export type {
  FeaturedShop,
  PaginatedProducts,
  PublicProduct,
  RecentProduct,
  ShopSummary,
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
    }),
  )
  .handler(async ({ data }) => {
    const { listProductsByCategorySlugQuery } = await import('./products.server')
    return listProductsByCategorySlugQuery(data.slug, {
      page: data.page,
      pageSize: data.pageSize,
    })
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
    const { getProductBySlugQuery } = await import('./products.server')
    const result = await getProductBySlugQuery(data.shopSlug, data.productSlug)

    if (!result) {
      throw notFound()
    }

    return result
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
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const getShopProducts = createServerFn({
  method: 'GET',
})
  .inputValidator(getShopProductsSchema)
  .handler(async ({ data }) => {
    const { getShopProductsQuery } = await import('./products.server')
    return getShopProductsQuery(data.shopSlug, data.search, {
      page: data.page,
      pageSize: data.pageSize,
    })
  })

const searchProductsSchema = z.object({
  query: z.string().max(255).optional(),
  categorySlug: z.string().min(1).optional(),
  shopSlug: z.string().min(1).optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
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
