import { createFileRoute } from '@tanstack/react-router'

import { authPipeline, requireRole, requireShopOwnership } from '#/lib/authz'

export const Route = createFileRoute('/api/shops/$shopId/products')({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        authPipeline(
          request,
          [requireRole('creator'), (ctx) => requireShopOwnership(ctx, params.shopId)],
          async () =>
            new Response(
              JSON.stringify({
                shopId: params.shopId,
                message: 'Product list',
                products: [],
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
        ),
      POST: async ({ request, params }) =>
        authPipeline(
          request,
          [requireRole('creator'), (ctx) => requireShopOwnership(ctx, params.shopId)],
          async () => {
            const body = await request.json().catch(() => ({}))
            return new Response(
              JSON.stringify({
                shopId: params.shopId,
                message: 'Product created',
                product: body,
              }),
              {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          },
        ),
    },
  },
})
