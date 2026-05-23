import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { listAllProducts } from '#/lib/admin-products'
import { listCategories } from '#/lib/categories'
import { listAllShops } from '#/lib/shop-moderation'
import {
  AdminProductsPage,
  AdminProductsPending,
  AdminProductsError,
} from '#/route-components/admin/products'

const productsSearchSchema = z.object({
  query: z.string().optional().default(''),
  shopId: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).optional().default(20),
})

export const Route = createFileRoute('/admin/products')({
  validateSearch: productsSearchSchema,
  loaderDeps: ({
    search: { query, shopId, categoryId, status, minPrice, maxPrice, page, pageSize },
  }) => ({
    query,
    shopId,
    categoryId,
    status,
    minPrice,
    maxPrice,
    page,
    pageSize,
  }),
  loader: async ({ deps }) => {
    const [products, shops, categories] = await Promise.all([
      listAllProducts({
        data: {
          query: deps.query || undefined,
          shopId: deps.shopId,
          categoryId: deps.categoryId,
          status: deps.status,
          minPriceCents: deps.minPrice ? deps.minPrice * 100 : undefined,
          maxPriceCents: deps.maxPrice ? deps.maxPrice * 100 : undefined,
          page: deps.page,
          pageSize: deps.pageSize,
        },
      }),
      listAllShops({ data: { filter: 'all', page: 1, pageSize: 1000 } }),
      listCategories({ data: { tree: true } }),
    ])
    return { products, shops: shops.shops, categories }
  },
  head: () => ({ meta: [{ title: 'Products | Admin | Eurtisan' }] }),
  component: AdminProductsPage,
  pendingComponent: AdminProductsPending,
  errorComponent: AdminProductsError,
})
