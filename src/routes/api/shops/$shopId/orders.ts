import { createFileRoute } from '@tanstack/react-router'

import { authPipeline, requireRole, requireShopOwnership } from '#/lib/authz'

export const Route = createFileRoute('/api/shops/$shopId/orders')({
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
                message: 'Order list',
                orders: [],
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
        ),
    },
  },
})
