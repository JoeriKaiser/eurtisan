import { createFileRoute } from '@tanstack/react-router'

import { authPipeline, requireRole, requireShopOwnership } from '#/lib/authz'
import { createProduct, listCreatorProducts } from '#/lib/creator-products.server'
import { ImageValidationError } from '#/lib/image-utils'

export const Route = createFileRoute('/api/shops/$shopId/products')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url)
        const page = Number(url.searchParams.get('page') ?? '1')
        const pageSize = Number(url.searchParams.get('pageSize') ?? '20')
        const active = url.searchParams.get('active') ?? 'all'
        const categoryId = url.searchParams.get('categoryId') ?? undefined

        return authPipeline(
          request,
          [requireRole('creator'), (ctx) => requireShopOwnership(ctx, params.shopId)],
          async () => {
            const result = await listCreatorProducts({
              data: {
                shopId: params.shopId,
                page,
                pageSize,
                active: active as 'true' | 'false' | 'all',
                categoryId,
              },
            })
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          },
        )
      },
      POST: async ({ request, params }) =>
        authPipeline(
          request,
          [requireRole('creator'), (ctx) => requireShopOwnership(ctx, params.shopId)],
          async () => {
            const body = await request.json().catch(() => ({}))

            try {
              const newProduct = await createProduct({
                data: {
                  ...body,
                  shopId: params.shopId,
                },
              })

              return new Response(
                JSON.stringify({
                  shopId: params.shopId,
                  message: 'Product created',
                  product: newProduct,
                }),
                {
                  status: 201,
                  headers: { 'Content-Type': 'application/json' },
                },
              )
            } catch (err) {
              if (err instanceof Error) {
                if (err.message === 'DUPLICATE_SLUG') {
                  return new Response(
                    JSON.stringify({
                      error: 'Conflict',
                      message: 'A product with this slug already exists in this shop',
                    }),
                    {
                      status: 409,
                      headers: { 'Content-Type': 'application/json' },
                    },
                  )
                }
                if (err.message === 'UNAUTHENTICATED') {
                  return new Response(
                    JSON.stringify({
                      error: 'Unauthorized',
                      message: 'Authentication required. Please sign in.',
                    }),
                    {
                      status: 401,
                      headers: { 'Content-Type': 'application/json' },
                    },
                  )
                }
                if (err.message === 'FORBIDDEN') {
                  return new Response(
                    JSON.stringify({
                      error: 'Forbidden',
                      message: 'You do not have permission to access this shop.',
                    }),
                    {
                      status: 403,
                      headers: { 'Content-Type': 'application/json' },
                    },
                  )
                }
                if (err instanceof ImageValidationError || err.message.includes('Invalid')) {
                  return new Response(
                    JSON.stringify({
                      error: 'Bad Request',
                      message: err.message,
                    }),
                    {
                      status: 400,
                      headers: { 'Content-Type': 'application/json' },
                    },
                  )
                }
              }
              throw err
            }
          },
        ),
    },
  },
})
