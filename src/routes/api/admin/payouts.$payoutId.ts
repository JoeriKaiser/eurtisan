import { createFileRoute } from '@tanstack/react-router'
import { authPipeline, requireRole } from '#/lib/authz'
import { markPayoutSentQuery } from '#/lib/payouts.server'

export const Route = createFileRoute('/api/admin/payouts/$payoutId')({
  server: {
    handlers: {
      POST: async ({ request, params }) =>
        authPipeline(request, [requireRole('admin')], async () => {
          try {
            const result = await markPayoutSentQuery(params.payoutId)
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          } catch (err) {
            if (err instanceof Response) {
              return err
            }
            throw err
          }
        }),
    },
  },
})
