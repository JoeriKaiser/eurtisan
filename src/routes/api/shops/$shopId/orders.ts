import { createFileRoute } from '@tanstack/react-router'

import { authPipeline, requireRole, requireShopOwnership } from '#/lib/authz'
import { listShopOrdersQuery } from '#/lib/shop-orders.server'

export const Route = createFileRoute('/api/shops/$shopId/orders')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url)
        const status = url.searchParams.get('status') ?? undefined
        const page = Number(url.searchParams.get('page') ?? '1')
        const pageSize = Number(url.searchParams.get('pageSize') ?? '20')

        return authPipeline(
          request,
          [requireRole('creator'), (ctx) => requireShopOwnership(ctx, params.shopId)],
          async () => {
            const result = await listShopOrdersQuery(params.shopId, {
              status,
              page,
              pageSize,
            })

            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          },
        )
      },
    },
  },
})
