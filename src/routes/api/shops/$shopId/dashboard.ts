import { createFileRoute } from '@tanstack/react-router'

import { authPipelinePrivileged, requireRole, requireShopOwnership } from '#/lib/authz'
import { getShopDashboardStatsQuery } from '#/lib/creator-dashboard.server'

export const Route = createFileRoute('/api/shops/$shopId/dashboard')({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        authPipelinePrivileged(
          request,
          [requireRole('creator'), (ctx) => requireShopOwnership(ctx, params.shopId)],
          async () => {
            const stats = await getShopDashboardStatsQuery(params.shopId)
            return new Response(JSON.stringify(stats), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          },
        ),
    },
  },
})
