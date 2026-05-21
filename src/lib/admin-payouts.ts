import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { authMiddleware } from './auth-middleware'

export type { AdminPayoutRow } from './payouts.server'

/* -------------------------------------------------------------------------- */
/*                               Auth Guard                                    */
/* -------------------------------------------------------------------------- */

/**
 * Shared admin auth guard — throws 401/403 if not authenticated or not admin.
 */
async function requireAdmin(context: { user?: { id: string; role: string } | null }) {
  if (!context.user) {
    throw new Response(
      JSON.stringify({
        error: 'Unauthorized',
        message: 'Authentication required. Please sign in.',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (context.user.role !== 'admin') {
    throw new Response(
      JSON.stringify({
        error: 'Forbidden',
        message: 'Admin access required.',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

/* -------------------------------------------------------------------------- */
/*                          List Pending Payouts                               */
/* -------------------------------------------------------------------------- */

/**
 * Returns all pending payouts enriched with creator and shop details.
 * Admin only.
 */
export const listPendingPayouts = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(context)

    const { listPendingPayoutsQuery } = await import('./payouts.server')
    return listPendingPayoutsQuery()
  })

/* -------------------------------------------------------------------------- */
/*                            Mark Payout Sent                                 */
/* -------------------------------------------------------------------------- */

export const markPayoutSentInputSchema = z.object({
  payoutId: z.string().min(1, 'Payout ID is required.'),
})

/**
 * Marks a pending payout as sent. Idempotent — marking an already-sent
 * payout succeeds without side effects.
 * Admin only.
 */
export const markPayoutSent = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(markPayoutSentInputSchema)
  .handler(async ({ context, data }) => {
    await requireAdmin(context)

    const { markPayoutSentQuery } = await import('./payouts.server')
    const result = await markPayoutSentQuery(data.payoutId)

    const { emitAuditEvent } = await import('./audit-log.server')
    await emitAuditEvent(context.user, 'payout.mark_sent', 'payout', data.payoutId)

    return result
  })

/* -------------------------------------------------------------------------- */
/*                          List Payout History                                */
/* -------------------------------------------------------------------------- */

export const listPayoutHistoryInputSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  from: z
    .string()
    .datetime()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  to: z
    .string()
    .datetime()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  query: z.string().optional(),
})

/**
 * Returns paginated payout history (all statuses) enriched with creator
 * and shop details.
 * Admin only.
 */
export const listPayoutHistory = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(listPayoutHistoryInputSchema)
  .handler(async ({ context, data }) => {
    await requireAdmin(context)

    const { listPayoutHistoryQuery } = await import('./payouts.server')
    return listPayoutHistoryQuery({
      page: data.page,
      pageSize: data.pageSize,
      from: data.from,
      to: data.to,
      query: data.query,
    })
  })
