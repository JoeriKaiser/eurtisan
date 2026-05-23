import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'
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

export const createProduct = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator(createProductSchema.extend({ shopId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    if (!context.user) {
      throw new Error('Unauthorized')
    }

    const { requireShopOwnership } = await import('./authz')
    await requireShopOwnership({ user: context.user as never, session: {} as never }, data.shopId)

    const { createProductInternal } = await import('./products.server')
    return createProductInternal(data)
  })

export const listProductsByCategorySlug = createServerFn({
  method: 'GET',
})
  .inputValidator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { listProductsByCategorySlugQuery } = await import('./products.server')
    return listProductsByCategorySlugQuery(data.slug)
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

export const listProductsSchema = z.object({
  shopSlug: z.string().min(1).optional(),
  categorySlug: z.string().min(1).optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).optional().default('newest'),
})

export const listProducts = createServerFn({
  method: 'GET',
})
  .inputValidator(listProductsSchema)
  .handler(async ({ data }) => {
    const { listProductsQuery } = await import('./products.server')
    return listProductsQuery(
      {
        shopSlug: data.shopSlug,
        categorySlug: data.categorySlug,
        minPriceCents: data.minPriceCents,
        maxPriceCents: data.maxPriceCents,
      },
      { page: data.page, pageSize: data.pageSize },
      data.sort,
    )
  })

export const getProductBySlugSchema = z.object({
  slug: z.string().min(1),
})

export const getProductBySlug = createServerFn({
  method: 'GET',
})
  .inputValidator(getProductBySlugSchema)
  .handler(async ({ data }) => {
    const { getProductBySlugQuery } = await import('./products.server')
    const result = await getProductBySlugQuery(data.slug)

    if (!result) {
      throw new Response(
        JSON.stringify({ error: 'Not Found', message: 'Product not found or unavailable' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return result
  })

export const getProductsByShopSchema = z.object({
  shopSlug: z.string().min(1),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const getProductsByShop = createServerFn({
  method: 'GET',
})
  .inputValidator(getProductsByShopSchema)
  .handler(async ({ data }) => {
    const { getProductsByShopSlugQuery } = await import('./products.server')
    return getProductsByShopSlugQuery(data.shopSlug, { page: data.page, pageSize: data.pageSize })
  })

export const getShopBySlugSchema = z.object({
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
      throw new Response(
        JSON.stringify({ error: 'Not Found', message: 'Shop not found or suspended' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return result
  })

export const getShopProductsSchema = z.object({
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

export const searchProductsSchema = z.object({
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
}).handler(async () => {
  const { listShopsQuery } = await import('./products.server')
  return listShopsQuery()
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
