import { createFileRoute } from '@tanstack/react-router'

import { authPipeline, requireRole, requireShopOwnership } from '#/lib/authz'
import { deleteProduct, updateProduct } from '#/lib/creator-products'
import { ImageValidationError } from '#/lib/image-utils'

export const Route = createFileRoute('/api/shops/$shopId/products/$productId')({
  server: {
    handlers: {
      PATCH: async ({ request, params }) =>
        authPipeline(
          request,
          [requireRole('creator'), (ctx) => requireShopOwnership(ctx, params.shopId)],
          async () => {
            const body = await request.json().catch(() => ({}))

            try {
              const updatedProduct = await updateProduct({
                data: {
                  ...body,
                  productId: params.productId,
                  shopId: params.shopId,
                },
              })

              return new Response(
                JSON.stringify({
                  shopId: params.shopId,
                  productId: params.productId,
                  message: 'Product updated',
                  product: updatedProduct,
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                },
              )
            } catch (err) {
              if (err instanceof Error) {
                if (err.message === 'NOT_FOUND') {
                  return new Response(
                    JSON.stringify({
                      error: 'Not Found',
                      message: 'Product not found',
                    }),
                    {
                      status: 404,
                      headers: { 'Content-Type': 'application/json' },
                    },
                  )
                }
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
                      message: 'You do not have permission to modify this product.',
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
      DELETE: async ({ request, params }) =>
        authPipeline(
          request,
          [requireRole('creator'), (ctx) => requireShopOwnership(ctx, params.shopId)],
          async () => {
            const url = new URL(request.url)
            const hard = url.searchParams.get('hard') === 'true'

            try {
              const result = await deleteProduct({
                data: {
                  productId: params.productId,
                  shopId: params.shopId,
                  hard,
                },
              })

              return new Response(
                JSON.stringify({
                  shopId: params.shopId,
                  productId: params.productId,
                  message: hard ? 'Product permanently deleted' : 'Product deactivated',
                  ...result,
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                },
              )
            } catch (err) {
              if (err instanceof Error) {
                if (err.message === 'NOT_FOUND') {
                  return new Response(
                    JSON.stringify({
                      error: 'Not Found',
                      message: 'Product not found',
                    }),
                    {
                      status: 404,
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
                      message: 'You do not have permission to delete this product.',
                    }),
                    {
                      status: 403,
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
