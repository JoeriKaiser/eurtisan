import { createFileRoute } from '@tanstack/react-router'

import { authPipeline, requireRole, requireShopOwnership } from '#/lib/authz'

export const Route = createFileRoute('/api/shops/$shopId/dashboard')({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        authPipeline(
          request,
          [
            requireRole('creator'),
            (ctx) => requireShopOwnership(ctx, params.shopId),
          ],
          async () =>
            new Response(
              JSON.stringify({
                shopId: params.shopId,
                message: 'Dashboard data',
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
