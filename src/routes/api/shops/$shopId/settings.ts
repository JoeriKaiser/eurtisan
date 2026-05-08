import { createFileRoute } from '@tanstack/react-router'

import { authPipeline, requireRole, requireShopOwnership } from '#/lib/authz'

export const Route = createFileRoute('/api/shops/$shopId/settings')({
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
                message: 'Settings data',
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            ),
        ),
      PATCH: async ({ request, params }) =>
        authPipeline(
          request,
          [
            requireRole('creator'),
            (ctx) => requireShopOwnership(ctx, params.shopId),
          ],
          async () => {
            const body = await request.json().catch(() => ({}))
            return new Response(
              JSON.stringify({
                shopId: params.shopId,
                message: 'Settings updated',
                data: body,
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          },
        ),
    },
  },
})
